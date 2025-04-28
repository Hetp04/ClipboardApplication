# Image Tagging with Groq AI

This feature allows the Clipboard Application to automatically tag images copied to the clipboard using Groq's powerful image understanding capabilities.

## Setup

1. Make sure Python 3.7+ is installed on your system
2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Set the `GROQ_API_KEY` environment variable to your Groq API key

## How It Works

1. When an image is copied to the clipboard, it's detected by the Rust backend
2. The image is passed to a Python script (`image_tagger.py`) for processing
3. The Python script:
   - Preprocesses the image (resize, format conversion)
   - Calls the Groq API's vision model to analyze the image
   - Generates exactly two general tags describing the image type
   - Assigns confidence scores to each tag
4. The tags are returned to the frontend and displayed with the image snippet

## Tags Generated

The system generates two general tags per image, such as:
- photo, screenshot, diagram, logo, icon, chart
- infographic, artwork, meme, document, illustration
- map, text-image, interface, poster, graph

The tags are deliberately kept broad and general to describe the image format and type, not specific content.

## API Reference

The Groq endpoint used is `llama3-70b-8192-vision`, which provides excellent image understanding capabilities. 