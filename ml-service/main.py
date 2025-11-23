from fastapi import FastAPI, HTTPException
from pydantic import BaseModel 
from transformers import ViTImageProcessor, ViTForImageClassification 
from PIL import Image
import torch
import base64
import io
from typing import Optional

app = FastAPI()

MODEL_NAME = "google/vit-base-patch16-224-in21k"
try:
    print("--- Loading model (this may take a minute)... ---")
    processor = ViTImageProcessor.from_pretrained(MODEL_NAME)
    model = ViTForImageClassification.from_pretrained(MODEL_NAME)
    print("--- Model loaded successfully! ---")
except Exception as e:
    print(f"--- Error loading model: {e} ---")
    processor = None
    model = None

class ScanRequest(BaseModel):
    scan_id: Optional[str] = None
    image_data: Optional[str] = None  # Base64 encoded image
    # Keep mri_scan_id for backward compatibility
    mri_scan_id: Optional[int] = None

@app.get("/")
def read_root():
    return {"message": "Hello! The ML Service is running."}


# --- 5. Create the REAL "Predict" Endpoint ---
@app.post("/predict")
async def predict_mri(request: ScanRequest):
    """
    This is the main endpoint your Java backend will call.
    Accepts base64 encoded image data from the backend.
    """
    try:
        # Check if image data is provided
        if request.image_data:
            # Decode base64 image data
            try:
                image_bytes = base64.b64decode(request.image_data)
                image = Image.open(io.BytesIO(image_bytes))
                print(f"--- Received image from backend (size: {len(image_bytes)} bytes) ---")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to decode image data: {str(e)}")
        else:
            # Fallback: try to use test image (for backward compatibility during development)
            try:
                image = Image.open("test_image.jpg")
                print("--- Using fallback test_image.jpg ---")
            except FileNotFoundError:
                raise HTTPException(status_code=400, detail="No image data provided and test_image.jpg not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load image: {str(e)}")

    # Check if model and processor are loaded
    if processor is None or model is None:
        raise HTTPException(status_code=500, detail="ML model not loaded. Check server logs for errors.")

    # The 'processor' resizes and normalizes the image
    inputs = processor(images=image, return_tensors="pt")

    # 3. Run the model to get a prediction
    with torch.no_grad(): # Tells PyTorch not to track changes (faster) and without gradients 
        outputs = model(**inputs)
    
    # 'logits' are the model's raw number scores
    logits = outputs.logits
    
    # Find the index of the highest score (e.g., class 281, "cat")
    predicted_class_idx = logits.argmax(-1).item()
    
    # 4. (SIMULATION) Create a FAKE, but realistic, result
    # The real index (e.g., 281) is meaningless for us.
    # We just use it to make a fake "ASD" or "VSD" result.
    
    # If the index is even, say "ASD". If odd, say "VSD".
    fake_prediction = "ASD" if predicted_class_idx % 2 == 0 else "VSD"
    
    # Get the model's confidence score for that prediction
    confidence = torch.softmax(logits, dim=-1)[0, predicted_class_idx].item()

    print(f"Prediction complete. Returning result: {fake_prediction} (confidence: {confidence:.4f})")
    
    # 5. Send back the final JSON response
    # Use scan_id if provided, otherwise fall back to mri_scan_id for backward compatibility
    scan_id = request.scan_id if request.scan_id else (str(request.mri_scan_id) if request.mri_scan_id else None)
    
    return {
        "scan_id": scan_id,  # Send back the scan ID
        "prediction": fake_prediction,
        "confidence_score": round(confidence, 4),  # A nice rounded number
        "status": "COMPLETED"
    }


