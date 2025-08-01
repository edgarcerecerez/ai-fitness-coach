import OpenAI from 'openai';
import logger from '@/lib/logger';

// Validate required environment variables
const apiKey = process.env.OPENAI_API_KEY;

// Only initialize if environment variable is available (not during build)
let openai: OpenAI | null = null;

if (apiKey) {
  openai = new OpenAI({
    apiKey: apiKey,
    maxRetries: 3,
    timeout: 60000, // 60 seconds
  });
  logger.info('OpenAI client initialized successfully');
} else {
  logger.warn('OPENAI_API_KEY environment variable is missing - OpenAI functionality will be disabled');
}

// Log initialization status for debugging
if (process.env.NODE_ENV !== 'production') {
  logger.info('OpenAI client initialization status:', { 
    initialized: !!openai, 
    hasApiKey: !!apiKey 
  });
}

// Helper function to get the OpenAI client with proper error handling
function getOpenAIClient(): OpenAI {
  if (!openai) {
    logger.error('Attempted to use OpenAI client but it is not initialized - OPENAI_API_KEY environment variable is required');
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return openai;
}

export interface NutritionAnalysis {
  foodItems: Array<{
    name: string;
    quantity: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  }>;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  confidenceScore: number;
  analysisNotes: string;
}

/**
 * Analyzes a base64-encoded food image using OpenAI's GPT-4 Vision model and returns detailed nutritional information.
 *
 * Sends the image to the OpenAI API with instructions to estimate food items, portion sizes, macronutrients, fiber, total values, confidence score, and analysis notes. Parses and returns the structured nutritional analysis.
 *
 * @param imageBase64 - The base64-encoded JPEG image of the food to analyze
 * @returns A NutritionAnalysis object containing per-item and total nutritional data, confidence score, and analysis notes
 */
export async function analyzeImageWithOpenAI(imageBase64: string): Promise<NutritionAnalysis> {
  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this food image and provide detailed nutritional information. Return a JSON object with the following structure:
              {
                "foodItems": [
                  {
                    "name": "food name",
                    "quantity": "estimated portion size",
                    "calories": number,
                    "protein_g": number,
                    "carbs_g": number,
                    "fat_g": number,
                    "fiber_g": number
                  }
                ],
                "totalCalories": number,
                "totalProtein": number,
                "totalCarbs": number,
                "totalFat": number,
                "totalFiber": number,
                "confidenceScore": number (0-1),
                "analysisNotes": "any additional observations"
              }
              
              Guidelines:
              - Provide realistic portion estimates
              - If uncertain, provide ranges and note in analysisNotes
              - Consider cooking methods and preparation
              - Rate confidence based on image clarity and recognizability`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    let analysis: NutritionAnalysis;
    try {
      analysis = JSON.parse(content) as NutritionAnalysis;
    } catch (parseError) {
      logger.error('Failed to parse OpenAI response as JSON', {
        error: parseError,
        content: content.substring(0, 500) // Log first 500 chars for debugging
      });
      throw new Error('Invalid JSON response from OpenAI');
    }
    
    logger.info('OpenAI analysis completed', {
      totalCalories: analysis.totalCalories,
      confidenceScore: analysis.confidenceScore,
      foodItemCount: analysis.foodItems.length
    });

    return analysis;
  } catch (error) {
    logger.error('OpenAI Vision analysis failed', { error });
    throw error;
  }
} 