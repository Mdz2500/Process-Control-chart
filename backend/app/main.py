from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import pbc_router

app = FastAPI(
    title="Process Behaviour Chart API",
    description="API for creating and analyzing Process Behaviour Charts",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pbc_router.router)

@app.get("/")
async def root():
    return {"message": "Process Behaviour Chart API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
