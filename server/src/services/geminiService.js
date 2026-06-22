import { GoogleGenerativeAI } from '@google/generative-ai';

export async function extractQuizFromPDF(pdfBuffer, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // We use gemini-1.5-flash which is fast and supports PDF inputs
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: "application/json" }
  });

  const pdfPart = {
    inlineData: {
      data: pdfBuffer.toString('base64'),
      mimeType: 'application/pdf'
    }
  };

  const prompt = `You will receive a PDF document. Extract up to 30 multiple-choice quiz
questions from its content. Each question must have exactly 4 answer
options with exactly one correct answer.

Return ONLY a JSON array, no markdown formatting, no code block backticks, in this exact schema:
[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctIndex": 0
  }
]

If the document does not contain enough extractable content for 30
questions, return as many high-quality questions as possible (minimum
quality over quantity). Do not invent facts not present or implied in
the document.`;

  console.log('Sending request to Gemini API...');
  const result = await model.generateContent([prompt, pdfPart]);
  const textResponse = result.response.text();
  console.log('Received response from Gemini API.');

  try {
    // Sanitize response in case the model ignored responseMimeType or added markdown wrappers
    let sanitizedText = textResponse.trim();
    if (sanitizedText.startsWith('```json')) {
      sanitizedText = sanitizedText.substring(7);
    } else if (sanitizedText.startsWith('```')) {
      sanitizedText = sanitizedText.substring(3);
    }
    if (sanitizedText.endsWith('```')) {
      sanitizedText = sanitizedText.substring(0, sanitizedText.length - 3);
    }
    sanitizedText = sanitizedText.trim();

    const parsedJson = JSON.parse(sanitizedText);
    if (!Array.isArray(parsedJson)) {
      throw new Error('Response is not a JSON array');
    }

    // Validate array items
    const validatedQuestions = parsedJson.map((q, idx) => {
      if (!q.question || typeof q.question !== 'string') {
        throw new Error(`Question at index ${idx} is missing a text field`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question at index ${idx} must have exactly 4 options`);
      }
      const correctIndex = parseInt(q.correctIndex, 10);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        throw new Error(`Question at index ${idx} has an invalid correctIndex: ${q.correctIndex}`);
      }
      return {
        question: q.question,
        options: q.options.map(String),
        correctIndex
      };
    });

    return validatedQuestions;
  } catch (error) {
    console.error('Failed to parse Gemini JSON response:', textResponse);
    throw new Error(`Gemini PDF extraction failed to return valid schema: ${error.message}`);
  }
}
