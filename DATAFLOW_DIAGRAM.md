# CHD-EPICS: Data Flow Diagrams

This document provides detailed data flow diagrams for all major operations in the CHD-EPICS system.

---

## Table of Contents
1. [System Context Diagram](#system-context-diagram)
2. [User Authentication Flow](#user-authentication-flow)
3. [Patient Data Creation Flow](#patient-data-creation-flow)
4. [Patient Data Access Flow](#patient-data-access-flow)
5. [ECG Scan Upload Flow](#ecg-scan-upload-flow)
6. [ML Prediction Flow](#ml-prediction-flow)
7. [Access Sharing Flow](#access-sharing-flow)
8. [Session Management Flow](#session-management-flow)
9. [Data Encryption/Decryption Flow](#data-encryptiondecryption-flow)

---

## System Context Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Client                              │
│                    (Frontend Application)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            │ (JSON Requests/Responses)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Spring Boot Backend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Controllers  │──│   Services   │──│ Repositories │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                 │                  │                 │
└─────────┼─────────────────┼──────────────────┼─────────────────┘
          │                 │                  │
          │                 │                  │
    ┌─────┴─────┐    ┌──────┴──────┐    ┌─────┴─────┐
    │           │    │             │    │           │
┌───▼───┐  ┌───▼───┐ │  ┌─────────▼──┐ │  ┌────────▼──┐
│PostgreSQL│ │ Redis │ │  │   MinIO   │ │  │ML Service │
│ Database │ │ Cache │ │  │  Storage  │ │  │ (FastAPI) │
└─────────┘ └───────┘ │  └───────────┘ │  └───────────┘
                      │                │
                      └────────────────┘
```

---

## User Authentication Flow

### 1. Registration Flow

```
┌─────────┐
│ Doctor  │
└────┬────┘
     │ 1. POST /api/auth/register
     │    {email, password, full_name, phone}
     ▼
┌─────────────────────────────────────┐
│      AuthController                 │
│      (Registration Endpoint)        │
└──────────────┬──────────────────────┘
               │
               │ 2. Validate input
               ▼
┌─────────────────────────────────────┐
│      AuthService                     │
│      (Registration Logic)            │
└──────────────┬──────────────────────┘
               │
               │ 3. Check if email exists
               ▼
┌─────────────────────────────────────┐
│   DoctorRepository                  │
│   (Database Query)                  │
└──────────────┬──────────────────────┘
               │
               │ 4. Email not found
               ▼
┌─────────────────────────────────────┐
│      AuthService                     │
│      (Password Hashing)              │
└──────────────┬──────────────────────┘
               │
               │ 5. Hash password with Argon2
               │    Generate RSA key pair
               │    Encrypt private key with KEK
               ▼
┌─────────────────────────────────────┐
│   DoctorRepository                  │
│   (Save Doctor)                      │
└──────────────┬──────────────────────┘
               │
               │ 6. INSERT INTO doctor
               │    INSERT INTO doctor_auth
               │    INSERT INTO doctor_crypto
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (doctor, doctor_auth,          │
│       doctor_crypto tables)         │
└──────────────┬──────────────────────┘
               │
               │ 7. Success response
               ▼
┌─────────────────────────────────────┐
│      AuthController                 │
│      (Return 201 Created)            │
└──────────────┬──────────────────────┘
               │
               │ 8. {status: "success", message: "Registered"}
               ▼
┌─────────┐
│ Doctor  │
└─────────┘
```

### 2. Login Flow

```
┌─────────┐
│ Doctor  │
└────┬────┘
     │ 1. POST /api/auth/login
     │    {email, password}
     ▼
┌─────────────────────────────────────┐
│      AuthController                 │
│      (Login Endpoint)               │
└──────────────┬──────────────────────┘
               │
               │ 2. Validate credentials
               ▼
┌─────────────────────────────────────┐
│      AuthService                     │
│      (Authentication Logic)          │
└──────────────┬──────────────────────┘
               │
               │ 3. Find doctor by email
               ▼
┌─────────────────────────────────────┐
│   DoctorRepository                  │
│   (Find by email)                    │
└──────────────┬──────────────────────┘
               │
               │ 4. SELECT doctor + doctor_auth
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
└──────────────┬──────────────────────┘
               │
               │ 5. Doctor found
               ▼
┌─────────────────────────────────────┐
│      AuthService                     │
│      (Verify Password)               │
└──────────────┬──────────────────────┘
               │
               │ 6. Verify Argon2 hash
               │    Check if account is active
               ▼
┌─────────────────────────────────────┐
│      AuthService                     │
│      (Generate Tokens)               │
└──────────────┬──────────────────────┘
               │
               │ 7. Generate JWT Access Token (15 min)
               │    Generate JWT Refresh Token (7 days)
               │    Create session record
               ▼
┌─────────────────────────────────────┐
│   SessionRepository                 │
│   (Save Session)                     │
└──────────────┬──────────────────────┘
               │
               │ 8. INSERT INTO session
               │    (doctor_id, login_at, ip, user_agent)
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (session table)                 │
└──────────────┬──────────────────────┘
               │
               │ 9. Store refresh token in Redis
               ▼
┌─────────────────────────────────────┐
│      Redis Cache                     │
│      (refresh_token:session_id)      │
└──────────────┬──────────────────────┘
               │
               │ 10. Return tokens
               ▼
┌─────────────────────────────────────┐
│      AuthController                 │
│      (Return 200 OK)                 │
└──────────────┬──────────────────────┘
               │
               │ 11. {
               │      accessToken: "...",
               │      refreshToken: "...",
               │      expiresIn: 900
               │     }
               ▼
┌─────────┐
│ Doctor  │
└─────────┘
```

---

## Patient Data Creation Flow

```
┌─────────┐
│ Doctor  │
└────┬────┘
     │ 1. POST /api/patients
     │    Authorization: Bearer <access_token>
     │    {patient_data: {...}}
     ▼
┌─────────────────────────────────────┐
│      PatientController              │
│      (Create Patient Endpoint)      │
└──────────────┬──────────────────────┘
               │
               │ 2. Validate JWT token
               │    Extract doctor_id from token
               ▼
┌─────────────────────────────────────┐
│      JwtService                     │
│      (Token Validation)             │
└──────────────┬──────────────────────┘
               │
               │ 3. Token valid, doctor_id extracted
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Patient Creation Logic)       │
└──────────────┬──────────────────────┘
               │
               │ 4. Generate anonymized_code
               │    Generate random DEK (AES-256)
               │    Encrypt patient data with DEK
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (AES-GCM Encryption)           │
└──────────────┬──────────────────────┘
               │
               │ 5. Encrypt payload
               │    Output: enc_payload, IV, Tag
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Key Wrapping)                 │
└──────────────┬──────────────────────┘
               │
               │ 6. Get doctor's public key
               ▼
┌─────────────────────────────────────┐
│   DoctorCryptoRepository            │
│   (Get Public Key)                   │
└──────────────┬──────────────────────┘
               │
               │ 7. SELECT public_key FROM doctor_crypto
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (doctor_crypto table)           │
└──────────────┬──────────────────────┘
               │
               │ 8. Public key retrieved
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (RSA Key Wrapping)             │
└──────────────┬──────────────────────┘
               │
               │ 9. Wrap DEK with doctor's public key
               │    Output: dek_enc, dek_iv, dek_tag
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Save to Database)             │
└──────────────┬──────────────────────┘
               │
               │ 10. Begin Transaction
               │     INSERT INTO patient
               │     INSERT INTO patient_key
               │     INSERT INTO patient_access (role: 'owner')
               │     INSERT INTO audit_log
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (patient, patient_key,          │
│       patient_access, audit_log)    │
└──────────────┬──────────────────────┘
               │
               │ 11. Commit transaction
               ▼
┌─────────────────────────────────────┐
│      PatientController              │
│      (Return 201 Created)           │
└──────────────┬──────────────────────┘
               │
               │ 12. {patient_id, anonymized_code}
               ▼
┌─────────┐
│ Doctor  │
└─────────┘
```

---

## Patient Data Access Flow

```
┌─────────┐
│ Doctor  │
└────┬────┘
     │ 1. GET /api/patients/{patient_id}
     │    Authorization: Bearer <access_token>
     ▼
┌─────────────────────────────────────┐
│      PatientController              │
│      (Get Patient Endpoint)         │
└──────────────┬──────────────────────┘
               │
               │ 2. Validate JWT token
               │    Extract doctor_id
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Access Control Check)         │
└──────────────┬──────────────────────┘
               │
               │ 3. Check access permission
               ▼
┌─────────────────────────────────────┐
│   PatientAccessRepository           │
│   (Check Permission)                 │
└──────────────┬──────────────────────┘
               │
               │ 4. SELECT role FROM patient_access
               │    WHERE doctor_id = ? AND patient_id = ?
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (patient_access table)          │
└──────────────┬──────────────────────┘
               │
               │ 5. Access granted (role found)
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Retrieve Encrypted Data)      │
└──────────────┬──────────────────────┘
               │
               │ 6. Get encrypted patient data
               │    Get encrypted DEK
               ▼
┌─────────────────────────────────────┐
│   PatientRepository                 │
│   PatientKeyRepository              │
│   (Fetch Data)                       │
└──────────────┬──────────────────────┘
               │
               │ 7. SELECT FROM patient
               │    SELECT FROM patient_key
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (patient, patient_key tables)   │
└──────────────┬──────────────────────┘
               │
               │ 8. Encrypted data retrieved
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Key Unwrapping)               │
└──────────────┬──────────────────────┘
               │
               │ 9. Get doctor's private key
               ▼
┌─────────────────────────────────────┐
│   DoctorCryptoRepository            │
│   (Get Private Key)                  │
└──────────────┬──────────────────────┘
               │
               │ 10. SELECT private_key_enc, private_key_salt, kek_params
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (doctor_crypto table)           │
└──────────────┬──────────────────────┘
               │
               │ 11. Private key data retrieved
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (KEK Derivation)               │
└──────────────┬──────────────────────┘
               │
               │ 12. Derive KEK from password using Argon2
               │     (Note: Password must be available in session)
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (Private Key Decryption)       │
└──────────────┬──────────────────────┘
               │
               │ 13. Decrypt private key with KEK
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (DEK Unwrapping)               │
└──────────────┬──────────────────────┘
               │
               │ 14. Unwrap DEK using private key
               │     Output: Plaintext DEK
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (Data Decryption)               │
└──────────────┬──────────────────────┘
               │
               │ 15. Decrypt patient payload with DEK
               │     Verify authentication tag
               │     Output: Plaintext patient data
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Log Access)                   │
└──────────────┬──────────────────────┘
               │
               │ 16. INSERT INTO audit_log
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (audit_log table)               │
└──────────────┬──────────────────────┘
               │
               │ 17. Return decrypted data
               ▼
┌─────────────────────────────────────┐
│      PatientController              │
│      (Return 200 OK)                 │
└──────────────┬──────────────────────┘
               │
               │ 18. {patient_data: {...}}
               ▼
┌─────────┐
│ Doctor  │
└─────────┘
```

---

## ECG Scan Upload Flow

```
┌─────────┐
│ Doctor  │
└────┬────┘
     │ 1. POST /api/scans/upload
     │    Authorization: Bearer <access_token>
     │    multipart/form-data: {file, patient_id}
     ▼
┌─────────────────────────────────────┐
│      ScanController                 │
│      (Upload Endpoint)              │
└──────────────┬──────────────────────┘
               │
               │ 2. Validate JWT token
               │    Validate file format
               │    Check patient access
               ▼
┌─────────────────────────────────────┐
│      ScanService                    │
│      (File Validation)              │
└──────────────┬──────────────────────┘
               │
               │ 3. Validate file type (image/jpeg, image/png)
               │    Check file size limits
               │    Verify patient access permission
               ▼
┌─────────────────────────────────────┐
│      ScanService                    │
│      (Generate Storage Path)        │
└──────────────┬──────────────────────┘
               │
               │ 4. Generate unique storage URI
               │    Format: patient_id/scan_id/filename
               │    Calculate file checksum (SHA-256)
               ▼
┌─────────────────────────────────────┐
│      ScanService                    │
│      (Upload to MinIO)              │
└──────────────┬──────────────────────┘
               │
               │ 5. Upload file to MinIO bucket
               ▼
┌─────────────────────────────────────┐
│      MinIO Client                   │
│      (Object Storage)               │
└──────────────┬──────────────────────┘
               │
               │ 6. PUT object to ecg-bucket
               │    Storage URI: patient_id/scan_id/filename
               ▼
┌─────────────────────────────────────┐
│      MinIO Server                   │
│      (Object Storage)               │
└──────────────┬──────────────────────┘
               │
               │ 7. File stored successfully
               ▼
┌─────────────────────────────────────┐
│      ScanService                    │
│      (Save Metadata)                │
└──────────────┬──────────────────────┘
               │
               │ 8. INSERT INTO ecg_scan
               │    INSERT INTO audit_log
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (ecg_scan, audit_log tables)    │
└──────────────┬──────────────────────┘
               │
               │ 9. Metadata saved
               ▼
┌─────────────────────────────────────┐
│      ScanController                 │
│      (Return 201 Created)            │
└──────────────┬──────────────────────┘
               │
               │ 10. {scan_id, storage_uri, uploaded_at}
               ▼
┌─────────┐
│ Doctor  │
└─────────┘
```

---

## ML Prediction Flow

```
┌─────────┐
│ Doctor  │
└────┬────┘
     │ 1. POST /api/ml/predict/{scan_id}
     │    Authorization: Bearer <access_token>
     ▼
┌─────────────────────────────────────┐
│      MLController                   │
│      (Predict Endpoint)             │
└──────────────┬──────────────────────┘
               │
               │ 2. Validate JWT token
               │    Validate scan_id
               │    Check scan access
               ▼
┌─────────────────────────────────────┐
│      MLService                      │
│      (Prepare Prediction)           │
└──────────────┬──────────────────────┘
               │
               │ 3. Get scan metadata
               ▼
┌─────────────────────────────────────┐
│   ScanRepository                    │
│   (Get Scan Info)                    │
└──────────────┬──────────────────────┘
               │
               │ 4. SELECT FROM ecg_scan
               │    WHERE scan_id = ?
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (ecg_scan table)                │
└──────────────┬──────────────────────┘
               │
               │ 5. Scan metadata retrieved
               │    storage_uri, patient_id
               ▼
┌─────────────────────────────────────┐
│      MLService                      │
│      (Download Image)               │
└──────────────┬──────────────────────┘
               │
               │ 6. Download image from MinIO
               ▼
┌─────────────────────────────────────┐
│      MinIO Client                   │
│      (Get Object)                   │
└──────────────┬──────────────────────┘
               │
               │ 7. GET object from ecg-bucket
               │    Using storage_uri
               ▼
┌─────────────────────────────────────┐
│      MinIO Server                   │
│      (Object Storage)               │
└──────────────┬──────────────────────┘
               │
               │ 8. Image file retrieved
               ▼
┌─────────────────────────────────────┐
│      MLService                      │
│      (Call ML Service)              │
└──────────────┬──────────────────────┘
               │
               │ 9. POST /predict
               │    {scan_id: ...}
               │    (Image sent as multipart or base64)
               ▼
┌─────────────────────────────────────┐
│      ML Service (FastAPI)           │
│      (Prediction Endpoint)          │
└──────────────┬──────────────────────┘
               │
               │ 10. Load image
               │     Preprocess with ViTImageProcessor
               ▼
┌─────────────────────────────────────┐
│      ViT Model                      │
│      (Vision Transformer)           │
└──────────────┬──────────────────────┘
               │
               │ 11. Run inference
               │     Get logits
               │     Apply softmax
               │     Get predicted class
               ▼
┌─────────────────────────────────────┐
│      ML Service (FastAPI)           │
│      (Format Response)              │
└──────────────┬──────────────────────┘
               │
               │ 12. Map to CHD labels (ASD/VSD)
               │     Calculate confidence
               │     Generate explanation URI (if available)
               ▼
┌─────────────────────────────────────┐
│      ML Service (FastAPI)           │
│      (Return Result)                │
└──────────────┬──────────────────────┘
               │
               │ 13. {
               │      prediction: "ASD",
               │      confidence: 0.9234,
               │      class_probs: {...},
               │      explanation_uri: "..."
               │     }
               ▼
┌─────────────────────────────────────┐
│      MLService                      │
│      (Save Result)                  │
└──────────────┬──────────────────────┘
               │
               │ 14. INSERT INTO ml_result
               │     INSERT INTO audit_log
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (ml_result, audit_log tables)  │
└──────────────┬──────────────────────┘
               │
               │ 15. Result saved
               ▼
┌─────────────────────────────────────┐
│      MLController                   │
│      (Return 200 OK)                 │
└──────────────┬──────────────────────┘
               │
               │ 16. {result_id, prediction, confidence, ...}
               ▼
┌─────────┐
│ Doctor  │
└─────────┘
```

---

## Access Sharing Flow

```
┌─────────┐
│ Owner   │
│ Doctor  │
└────┬────┘
     │ 1. POST /api/patients/{patient_id}/share
     │    Authorization: Bearer <access_token>
     │    {recipient_doctor_id, role: "viewer"}
     ▼
┌─────────────────────────────────────┐
│      PatientController              │
│      (Share Endpoint)               │
└──────────────┬──────────────────────┘
               │
               │ 2. Validate JWT token
               │    Extract owner_doctor_id
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Access Control Check)         │
└──────────────┬──────────────────────┘
               │
               │ 3. Verify owner has 'owner' role
               │    Verify recipient doctor exists
               ▼
┌─────────────────────────────────────┐
│   PatientAccessRepository           │
│   DoctorRepository                  │
│   (Verify Permissions)               │
└──────────────┬──────────────────────┘
               │
               │ 4. SELECT role FROM patient_access
               │    SELECT FROM doctor WHERE doctor_id = ?
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (patient_access, doctor tables) │
└──────────────┬──────────────────────┘
               │
               │ 5. Owner verified, recipient exists
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Retrieve DEK)                 │
└──────────────┬──────────────────────┘
               │
               │ 6. Get encrypted DEK for owner
               │    Unwrap DEK using owner's private key
               ▼
┌─────────────────────────────────────┐
│   PatientKeyRepository              │
│   EncryptionService                 │
│   (DEK Retrieval & Unwrapping)       │
└──────────────┬──────────────────────┘
               │
               │ 7. Plaintext DEK obtained
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Wrap DEK for Recipient)       │
└──────────────┬──────────────────────┘
               │
               │ 8. Get recipient's public key
               ▼
┌─────────────────────────────────────┐
│   DoctorCryptoRepository            │
│   (Get Recipient Public Key)         │
└──────────────┬──────────────────────┘
               │
               │ 9. SELECT public_key FROM doctor_crypto
               │    WHERE doctor_id = recipient_id
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (doctor_crypto table)           │
└──────────────┬──────────────────────┘
               │
               │ 10. Recipient's public key retrieved
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (RSA Key Wrapping)             │
└──────────────┬──────────────────────┘
               │
               │ 11. Wrap DEK with recipient's public key
               │     Output: dek_enc, dek_iv, dek_tag
               ▼
┌─────────────────────────────────────┐
│      PatientService                 │
│      (Save Access & Key)             │
└──────────────┬──────────────────────┘
               │
               │ 12. Begin Transaction
               │     INSERT INTO patient_key
               │     INSERT INTO patient_access
               │     INSERT INTO audit_log
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (patient_key, patient_access,  │
│       audit_log tables)              │
└──────────────┬──────────────────────┘
               │
               │ 13. Commit transaction
               ▼
┌─────────────────────────────────────┐
│      PatientController              │
│      (Return 200 OK)                 │
└──────────────┬──────────────────────┘
               │
               │ 14. {status: "shared", role: "viewer"}
               ▼
┌─────────┐
│ Owner   │
│ Doctor  │
└─────────┘
```

---

## Session Management Flow

```
┌─────────┐
│ Doctor  │
└────┬────┘
     │ 1. Every API Request
     │    Authorization: Bearer <access_token>
     ▼
┌─────────────────────────────────────┐
│      JwtAuthenticationFilter        │
│      (Token Validation)             │
└──────────────┬──────────────────────┘
               │
               │ 2. Extract token from header
               │    Validate token signature
               │    Check expiration
               ▼
┌─────────────────────────────────────┐
│      JwtService                     │
│      (Token Validation)             │
└──────────────┬──────────────────────┘
               │
               │ 3. Check if token is blacklisted
               ▼
┌─────────────────────────────────────┐
│      Redis Cache                     │
│      (Token Blacklist)              │
└──────────────┬──────────────────────┘
               │
               │ 4. Token not blacklisted
               ▼
┌─────────────────────────────────────┐
│      JwtService                     │
│      (Extract Session ID)           │
└──────────────┬──────────────────────┘
               │
               │ 5. Extract session_id from token claims
               │    Update last_activity_at
               ▼
┌─────────────────────────────────────┐
│   SessionRepository                 │
│   (Update Activity)                   │
└──────────────┬──────────────────────┘
               │
               │ 6. UPDATE session
               │    SET last_activity_at = NOW()
               │    WHERE session_id = ?
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (session table)                 │
└──────────────┬──────────────────────┘
               │
               │ 7. Session updated
               │    Continue to controller
               ▼
┌─────────────────────────────────────┐
│      Controller                      │
│      (Process Request)               │
└──────────────┬──────────────────────┘
               │
               │ 8. Handle request
               ▼
┌─────────────────────────────────────┐
│      Response                        │
└──────────────┬──────────────────────┘
               │
               │ 9. Return response
               ▼
┌─────────┐
│ Doctor  │
└─────────┘

┌─────────────────────────────────────┐
│      Background Job                  │
│      (Session Timeout Check)        │
└──────────────┬──────────────────────┘
               │
               │ Periodic check (every 5 minutes)
               │ Find sessions with last_activity_at > 30 min
               ▼
┌─────────────────────────────────────┐
│   SessionRepository                 │
│   (Find Expired Sessions)             │
└──────────────┬──────────────────────┘
               │
               │ SELECT * FROM session
               │ WHERE last_activity_at < NOW() - INTERVAL '30 minutes'
               │ AND logout_at IS NULL
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (session table)                 │
└──────────────┬──────────────────────┘
               │
               │ Expired sessions found
               ▼
┌─────────────────────────────────────┐
│      SessionService                 │
│      (Mark as Timeout)              │
└──────────────┬──────────────────────┘
               │
               │ UPDATE session
               │ SET logout_at = NOW(), ended_by = 'timeout'
               │ WHERE session_id IN (...)
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      (session table)                 │
└─────────────────────────────────────┘
```

---

## Data Encryption/Decryption Flow

### Encryption Flow (Write Operation)

```
┌─────────────────────────────────────┐
│      Plaintext Patient Data         │
│      {name, age, diagnosis, ...}    │
└──────────────┬──────────────────────┘
               │
               │ 1. Generate random DEK
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (DEK Generation)               │
│      - Generate 256-bit random key   │
└──────────────┬──────────────────────┘
               │
               │ 2. DEK: 0x3a7f9b2c...
               │     Encrypt data with AES-GCM
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (AES-GCM Encryption)           │
│      - Algorithm: AES-256-GCM       │
│      - Input: Plaintext + DEK       │
│      - Output: Ciphertext + IV + Tag│
└──────────────┬──────────────────────┘
               │
               │ 3. enc_payload: 0x8f2a...
               │    enc_payload_iv: 0x1b3c...
               │    enc_payload_tag: 0x9d4e...
               │
               │    Wrap DEK with doctor's public key
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (RSA Key Wrapping)             │
│      - Algorithm: RSA-OAEP          │
│      - Input: DEK + Public Key      │
│      - Output: Encrypted DEK        │
└──────────────┬──────────────────────┘
               │
               │ 4. dek_enc: 0x7f3a...
               │    dek_iv: 0x2b5c...
               │    dek_tag: 0x8e1f...
               │
               │    Store in database
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      - patient.enc_payload           │
│      - patient.enc_payload_iv        │
│      - patient.enc_payload_tag       │
│      - patient_key.dek_enc           │
│      - patient_key.dek_iv            │
│      - patient_key.dek_tag           │
└─────────────────────────────────────┘
```

### Decryption Flow (Read Operation)

```
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│      - patient.enc_payload           │
│      - patient.enc_payload_iv        │
│      - patient.enc_payload_tag       │
│      - patient_key.dek_enc           │
│      - patient_key.dek_iv            │
│      - patient_key.dek_tag           │
└──────────────┬──────────────────────┘
               │
               │ 1. Retrieve encrypted data
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (Get Doctor's Private Key)     │
└──────────────┬──────────────────────┘
               │
               │ 2. Get encrypted private key
               │    Get KEK params
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (Derive KEK from Password)     │
│      - Algorithm: Argon2id          │
│      - Input: Password + Salt       │
│      - Output: KEK                  │
└──────────────┬──────────────────────┘
               │
               │ 3. KEK: 0x4f8a...
               │     Decrypt private key with KEK
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (Private Key Decryption)        │
│      - Algorithm: AES-GCM            │
│      - Input: enc_private_key + KEK  │
│      - Output: Plaintext Private Key │
└──────────────┬──────────────────────┘
               │
               │ 4. Private Key: 0x9b2c...
               │     Unwrap DEK using private key
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (RSA Key Unwrapping)           │
│      - Algorithm: RSA-OAEP          │
│      - Input: dek_enc + Private Key │
│      - Output: Plaintext DEK        │
└──────────────┬──────────────────────┘
               │
               │ 5. DEK: 0x3a7f9b2c...
               │     Decrypt patient data with DEK
               ▼
┌─────────────────────────────────────┐
│      EncryptionService              │
│      (AES-GCM Decryption)           │
│      - Algorithm: AES-256-GCM       │
│      - Input: Ciphertext + IV + Tag │
│      - Output: Plaintext            │
│      - Verify authentication tag     │
└──────────────┬──────────────────────┘
               │
               │ 6. Plaintext Patient Data
               ▼
┌─────────────────────────────────────┐
│      Plaintext Patient Data          │
│      {name, age, diagnosis, ...}     │
└─────────────────────────────────────┘
```

---

## Summary

This document provides comprehensive data flow diagrams for all major operations in the CHD-EPICS system:

1. **Authentication**: Registration and login with JWT tokens
2. **Patient Management**: Creation and access with encryption
3. **File Management**: ECG scan upload to MinIO
4. **ML Integration**: Prediction workflow with external ML service
5. **Access Control**: Sharing patient data with other doctors
6. **Session Management**: Token validation and timeout handling
7. **Encryption**: Multi-layer encryption/decryption process

Each flow shows:
- **Data movement** between components
- **Database operations** (SELECT, INSERT, UPDATE)
- **External service calls** (MinIO, ML Service, Redis)
- **Security checks** (authentication, authorization, encryption)
- **Error handling points** (validation, access control)

These diagrams serve as a reference for:
- **Developers** implementing the system
- **Architects** reviewing the design
- **Security auditors** understanding data protection
- **QA engineers** testing the flows






