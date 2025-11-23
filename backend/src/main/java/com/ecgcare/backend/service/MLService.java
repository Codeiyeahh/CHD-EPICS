package com.ecgcare.backend.service;

import com.ecgcare.backend.dto.response.MlResultResponse;
import com.ecgcare.backend.entity.Doctor;
import com.ecgcare.backend.entity.EcgScan;
import com.ecgcare.backend.entity.MlResult;
import com.ecgcare.backend.exception.ForbiddenException;
import com.ecgcare.backend.exception.NotFoundException;
import com.ecgcare.backend.repository.DoctorRepository;
import com.ecgcare.backend.repository.EcgScanRepository;
import com.ecgcare.backend.repository.MlResultRepository;
import com.ecgcare.backend.repository.PatientAccessRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MLService {
        private final MlResultRepository mlResultRepository;
        private final EcgScanRepository scanRepository;
        private final DoctorRepository doctorRepository;
        private final PatientAccessRepository patientAccessRepository;
        private final AuditService auditService;
        private final RestTemplate restTemplate;
        private final ScanService scanService;

        private static final String ML_SERVICE_URL = "http://localhost:8000/predict";

        @Transactional
        public MlResultResponse predict(UUID scanId, UUID doctorId, String modelVersion, BigDecimal threshold) {
                EcgScan scan = scanRepository.findById(scanId)
                                .orElseThrow(() -> new NotFoundException("Scan not found"));

                // Check access
                patientAccessRepository.findRoleByPatientIdAndDoctorId(scan.getPatient().getPatientId(), doctorId)
                                .orElseThrow(() -> new ForbiddenException("No access to this scan"));

                Doctor doctor = doctorRepository.findById(doctorId)
                                .orElseThrow(() -> new NotFoundException("Doctor not found"));

                try {
                        // Download image from MinIO
                        InputStream imageStream = scanService.downloadScan(scanId, doctorId);

                        // Convert image to base64
                        byte[] imageBytes = imageStream.readAllBytes();
                        String base64Image = Base64.getEncoder().encodeToString(imageBytes);

                        log.debug("Downloaded image for scan {} (size: {} bytes)", scanId, imageBytes.length);

                        // Prepare request to ML service
                        Map<String, Object> request = new HashMap<>();
                        request.put("scan_id", scanId.toString());
                        request.put("image_data", base64Image);

                        // Set headers for JSON request
                        HttpHeaders headers = new HttpHeaders();
                        headers.setContentType(MediaType.APPLICATION_JSON);
                        HttpEntity<Map<String, Object>> httpEntity = new HttpEntity<>(request, headers);

                        // Call ML service
                        Map<String, Object> response = restTemplate.postForObject(ML_SERVICE_URL, httpEntity,
                                        Map.class);

                        if (response == null) {
                                throw new RuntimeException("ML service returned null response");
                        }

                        String predictedLabel = (String) response.get("prediction");
                        Object confidenceObj = response.get("confidence_score");
                        Double confidenceScore;
                        if (confidenceObj instanceof Number) {
                                confidenceScore = ((Number) confidenceObj).doubleValue();
                        } else {
                                confidenceScore = Double.parseDouble(confidenceObj.toString());
                        }

                        Map<String, Object> classProbs = new HashMap<>();
                        classProbs.put("ASD", predictedLabel.equals("ASD") ? confidenceScore : 1.0 - confidenceScore);
                        classProbs.put("VSD", predictedLabel.equals("VSD") ? confidenceScore : 1.0 - confidenceScore);

                        // Save result
                        MlResult result = MlResult.builder()
                                        .patient(scan.getPatient())
                                        .scan(scan)
                                        .modelVersion(modelVersion != null ? modelVersion : "v1.0")
                                        .predictedLabel(predictedLabel)
                                        .classProbs(classProbs)
                                        .threshold(threshold != null ? threshold : new BigDecimal("0.5"))
                                        .createdBy(doctor)
                                        .build();
                        result = mlResultRepository.save(result);

                        auditService.logAction("predict", "ml_result", result.getResultId(), doctorId, null, null);

                        return MlResultResponse.builder()
                                        .resultId(result.getResultId())
                                        .scanId(scanId)
                                        .patientId(scan.getPatient().getPatientId())
                                        .modelVersion(result.getModelVersion())
                                        .predictedLabel(predictedLabel)
                                        .confidenceScore(BigDecimal.valueOf(confidenceScore))
                                        .classProbabilities(classProbs)
                                        .threshold(result.getThreshold())
                                        .createdBy(doctorId)
                                        .createdAt(result.getCreatedAt())
                                        .build();
                } catch (Exception e) {
                        log.error("Failed to get prediction", e);
                        throw new RuntimeException("Failed to get prediction: " + e.getMessage());
                }
        }

        public MlResultResponse getResult(UUID resultId, UUID doctorId) {
                MlResult result = mlResultRepository.findById(resultId)
                                .orElseThrow(() -> new NotFoundException("Result not found"));

                // Check access
                patientAccessRepository.findRoleByPatientIdAndDoctorId(result.getPatient().getPatientId(), doctorId)
                                .orElseThrow(() -> new ForbiddenException("No access to this result"));

                return MlResultResponse.builder()
                                .resultId(result.getResultId())
                                .scanId(result.getScan() != null ? result.getScan().getScanId() : null)
                                .patientId(result.getPatient().getPatientId())
                                .modelVersion(result.getModelVersion())
                                .predictedLabel(result.getPredictedLabel())
                                .confidenceScore(BigDecimal
                                                .valueOf(((Number) result.getClassProbs()
                                                                .get(result.getPredictedLabel())).doubleValue()))
                                .classProbabilities(result.getClassProbs())
                                .threshold(result.getThreshold())
                                .explanationUri(result.getExplanationUri())
                                .createdBy(result.getCreatedBy() != null ? result.getCreatedBy().getDoctorId() : null)
                                .createdAt(result.getCreatedAt())
                                .build();
        }

        public com.ecgcare.backend.dto.response.PageResponse<MlResultResponse> listPatientPredictions(UUID patientId,
                        UUID doctorId, int page, int size) {
                // Check access
                patientAccessRepository.findRoleByPatientIdAndDoctorId(patientId, doctorId)
                                .orElseThrow(() -> new ForbiddenException("No access to this patient"));

                Pageable pageable = PageRequest.of(page, size);
                Page<MlResult> results = mlResultRepository.findByPatientId(patientId, pageable);

                List<MlResultResponse> resultResponses = results.getContent().stream()
                                .map(result -> MlResultResponse.builder()
                                                .resultId(result.getResultId())
                                                .scanId(result.getScan() != null ? result.getScan().getScanId() : null)
                                                .predictedLabel(result.getPredictedLabel())
                                                .confidenceScore(BigDecimal.valueOf(
                                                                ((Number) result.getClassProbs()
                                                                                .get(result.getPredictedLabel()))
                                                                                .doubleValue()))
                                                .createdAt(result.getCreatedAt())
                                                .build())
                                .collect(Collectors.toList());

                com.ecgcare.backend.dto.response.PageResponse.PaginationInfo pagination = com.ecgcare.backend.dto.response.PageResponse.PaginationInfo
                                .builder()
                                .page(results.getNumber())
                                .size(results.getSize())
                                .totalElements(results.getTotalElements())
                                .totalPages(results.getTotalPages())
                                .build();

                return com.ecgcare.backend.dto.response.PageResponse.<MlResultResponse>builder()
                                .content(resultResponses)
                                .pagination(pagination)
                                .build();
        }
}
