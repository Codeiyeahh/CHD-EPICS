from fastapi import FastAPI
from pydantic import BaseModel 
from transformers import ViTImageProcessor, ViTForImageClassification 
from PIL import Image
import torch

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
    mri_scan_id: int

@app.get("/")
def read_root():
    return {"message": "Hello! The ML Service is running."}


# --- 5. Create the REAL "Predict" Endpoint ---
@app.post("/predict")
async def predict_mri(request: ScanRequest):
    """
    This is the main endpoint your Java backend will call.
    """
    try:
        # Make sure you have an image named "test_image.jpg"
        # in the same folder as main.py
        image = Image.open("test_image.jpg") #(Later, you'll replace this line with code to download the real image from Supabase).
    except FileNotFoundError:
        # If the image is missing, send an error
        return {"error": "test_image.jpg not found! Please add it."}

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

    print(f"Prediction complete. Returning fake result: {fake_prediction}")
    
    # 5. Send back the final JSON response
    return {
        "mri_scan_id": request.mri_scan_id, # Send back the ID they gave us
        "prediction": fake_prediction,
        "confidence_score": round(confidence, 4), # A nice rounded number
        "status": "COMPLETED"
    }


