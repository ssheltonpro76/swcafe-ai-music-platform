
import { GoogleGenAI, Type, Modality } from "@google/genai";

export const generateMusicAdvice = async (prompt: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional music producer and audio engineer at SwCafe Business. Your goal is to help users with songwriting, mixing, mastering, and audio production tips. Keep answers professional, inspiring, and concise.",
        temperature: 0.7,
      },
    });
    return response.text || "I'm having trouble coming up with a production tip right now.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI producer assistant.";
  }
};

export interface LyricsGenOptions {
  theme: string;
  genre?: string;
  mood?: string;
  structure?: string;
  complexity?: string;
  rhymeScheme?: string;
  customPrompt?: string;
}

export const suggestLyricsChujai = async (
  topic: string, 
  genre: string = 'Pop', 
  complexity: string = 'High',
  mood?: string,
  structure?: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const promptText = `Generate high-quality, professional song lyrics.
Topic/Theme: "${topic}"
Genre: ${genre}
Mood: ${mood || 'Dynamic'}
Complexity: ${complexity}
Structure Desired: ${structure || '[Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Chorus], [Bridge], [Chorus], [Outro]'}

Formatting Rules:
- Mark every song section with bracketed headers like [Intro], [Verse 1], [Chorus], [Bridge], [Outro], [Drop], [Hook].
- Include musical cues or production tags where appropriate (e.g. (vocals soft), (drum build-up), (guitar crescendo)).
- Ensure natural rhythm, meter, rhyme, and emotional depth suitable for vocal performance.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: promptText,
      config: {
        systemInstruction: "You are an elite, Grammy-caliber songwriter and music lyricist at SwCafe. You craft verses and choruses with profound emotional resonance, impeccable cadence, and vivid imagery.",
        temperature: 0.85,
      },
    });
    return response.text || generateFallbackLyrics(topic, genre);
  } catch (error) {
    console.error("Gemini Chujai Error:", error);
    return generateFallbackLyrics(topic, genre);
  }
};

export const continueLyricsWithAI = async (
  existingLyrics: string,
  theme: string,
  genre: string = 'Alternative',
  nextSection: string = 'Next Section'
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const promptText = `The songwriter has written the following lyrics so far:
"""
${existingLyrics}
"""

The overall theme is: "${theme || 'Original composition'}"
Genre: "${genre}"

Task: Continue this song naturally by writing the ${nextSection}. 
Maintain the same rhyme scheme, emotional tone, vocabulary style, and rhythmic meter established by the songwriter. 
Output ONLY the new continued section with appropriate section tags (e.g. [Chorus], [Verse 2], or [Bridge]).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: promptText,
      config: {
        systemInstruction: "You are a master co-writer. You listen carefully to what the artist has written and build the next logical, powerful lyrical section that fits seamlessly into their song.",
        temperature: 0.85,
      },
    });
    return response.text || `\n\n[Chorus]\nAnd now we find the light again\nBeyond the shadows of the rain\nWe carry all we learned inside\nWith nothing left for us to hide`;
  } catch (error) {
    console.error("Gemini Co-Writer Error:", error);
    return `\n\n[Chorus]\nAnd now we find the light again\nBeyond the shadows of the rain\nWe carry all we learned inside\nWith nothing left for us to hide`;
  }
};

export const polishLyricsWithAI = async (
  lyricsToPolish: string,
  instruction: string,
  genre: string = 'Alternative'
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const promptText = `Refine and polish these lyrics according to this instruction: "${instruction || 'Improve rhythm, flow, and metaphors'}".
Genre: ${genre}

Original Lyrics:
"""
${lyricsToPolish}
"""

Please provide the polished version, maintaining section tags like [Verse 1], [Chorus], etc.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: promptText,
      config: {
        systemInstruction: "You are an expert lyric doctor and vocal producer. You elevate rough song drafts into polished, radio-ready lyrics.",
        temperature: 0.75,
      },
    });
    return response.text || lyricsToPolish;
  } catch (error) {
    console.error("Gemini Lyric Polish Error:", error);
    return lyricsToPolish;
  }
};

export const suggestRhymesAndMetaphors = async (
  lineOrWord: string,
  genre: string = 'Pop'
): Promise<{ rhymes: string[]; slantRhymes: string[]; metaphors: string[]; nextLines: string[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `Provide rhyming words, slant rhymes, poetic metaphors, and 3 inspiring next-line ideas for songwriting based on: "${lineOrWord}" (Genre: ${genre}).`,
      config: {
        systemInstruction: "You are a songwriting rhyming dictionary and creative muse. Return JSON with 'rhymes', 'slantRhymes', 'metaphors', and 'nextLines'.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rhymes: { type: Type.ARRAY, items: { type: Type.STRING } },
            slantRhymes: { type: Type.ARRAY, items: { type: Type.STRING } },
            metaphors: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextLines: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['rhymes', 'slantRhymes', 'metaphors', 'nextLines']
        }
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Rhyme suggestion error:", error);
    return {
      rhymes: ['glow', 'snow', 'below', 'echo', 'shadow'],
      slantRhymes: ['hold', 'stone', 'home', 'flowed'],
      metaphors: ['A lighthouse in a midnight sea', 'Broken glass reflecting starlight', 'Echoes frozen in the winter air'],
      nextLines: [
        'And watch the embers slowly turn to gray',
        'Where every secret that we kept began to fade',
        'Before the morning breaks the silence of the night'
      ]
    };
  }
};

const generateFallbackLyrics = (topic: string, genre: string): string => {
  return `[Intro]
(Atmospheric pads and gentle guitars fade in)

[Verse 1]
Footsteps echo down the empty hall
Whispers written on the bedroom wall
Everything we built began to shake
From the quiet promises we couldn't make

[Pre-Chorus]
Can you feel the shift inside the air?
Reaching for someone who isn't there

[Chorus]
${topic ? `Singing of ${topic}` : 'Searching for the light we used to know'}
Caught between the current and the undertow
Let the music carry all the scars away
Into the dawn of a brand new day

[Verse 2]
Neon streetlights flickering in time
Searching for a reason or a rhyme
Every melody is holding on
Long after the words we spoke are gone

[Bridge]
(Heavy drums and building resonance)
Break the cycle, let the silence fall
We were never meant to lose it all

[Chorus]
${topic ? `Singing of ${topic}` : 'Searching for the light we used to know'}
Caught between the current and the undertow
Let the music carry all the scars away
Into the dawn of a brand new day

[Outro]
(Vocal echoes fade into harmonic reverb)
Brand new day...
Fading away...`;
};

export const generateSoundtrackFromMedia = async (mediaData: string, mimeType: string, prompt: string = ''): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: mediaData.split(',')[1], // Remove base64 prefix
      },
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { 
        parts: [
          imagePart, 
          { text: `Analyze this visual scene and translate it into a professional musical soundtrack blueprint. 
          Provide: 
          1. Visual Analysis (Colors, Mood, Story)
          2. Soundtrack Profile (Genre, BPM, Key)
          3. Recommended Instrumentation
          4. Neural Lyrics (A verse and chorus inspired by the visual)
          ${prompt ? `User specific request: ${prompt}` : ''}` }
        ] 
      },
      config: {
        systemInstruction: "You are a professional film composer and synesthetic producer. You excel at translating visual atmospheres into detailed musical structures and poetic lyrics.",
        temperature: 0.8,
      },
    });
    return response.text || "Neural scan completed with no audio data.";
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return "Failed to perform synesthetic scan.";
  }
};

/**
 * Generates two distinct versions of a song section for the 'Replace Section' feature.
 */
export const generateReplacedSection = async (originalLyrics: string, targetWindow: string, newLyrics: string, genre: string): Promise<{v1: string, v2: string}> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
        [REPLACE SECTION ENGINE v4]
        Original Song Segment (${targetWindow}):
        "${originalLyrics}"
        
        Proposed Replacement (Targeting ${genre} genre):
        "${newLyrics}"
        
        Generate TWO distinct lyrical/structural variations for this specific section. 
        Ensure they maintain the rhythm and meter of the genre while incorporating the new lyrics or tags like [drum break].
      `,
      config: {
        systemInstruction: "You are a professional session songwriter. Generate two distinct versions of a song section in JSON format with keys 'v1' and 'v2'. Keep them concise and ready for production.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            v1: { type: Type.STRING },
            v2: { type: Type.STRING },
          },
          required: ['v1', 'v2']
        }
      },
    });
    
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Replace Section Error:", error);
    return { v1: "Error generating variation 1", v2: "Error generating variation 2" };
  }
};

export const getRemasteringAnalysis = async (trackInfo: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this track for remastering: ${trackInfo}. Provide specific spectral enhancement suggestions to bring it to 'v4' professional quality.`,
      config: {
        systemInstruction: "You are a Neural Mastering Engineer. Provide technical analysis of EQ, dynamic range, and stereo width enhancements.",
        temperature: 0.4,
      },
    });
    return response.text || "No analysis available.";
  } catch (error) {
    return "Mastering hub unavailable.";
  }
};

export const generateSongStructure = async (params: {
  prompt: string,
  genre: string,
  instruments: string[],
  mood: number,
  tempo: number,
  complexity: number
}): Promise<string> => {
  try {
    const moodText = params.mood < 30 ? "Chill" : params.mood < 70 ? "Balanced" : "Energetic";
    const complexityText = params.complexity < 30 ? "Simple/Minimalist" : params.complexity < 70 ? "Moderate" : "Orchestral/Complex";
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Create a v4 song blueprint for: "${params.prompt}". 
      Genre: ${params.genre}. 
      Instrumentation: ${params.instruments.join(', ')}. 
      Mood: ${moodText}. 
      Tempo: ${params.tempo} BPM. 
      Complexity: ${complexityText}.`,
      config: {
        systemInstruction: "You are an Elite AI Music Composer. Generate a professional song structure. Format with Markdown.",
        temperature: 0.8,
      },
    });
    return response.text || "Song generation failed.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating song blueprint.";
  }
};

export const generateAlbumArt = async (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1"): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [{ text: `v4 High-quality cinematic album cover art: ${prompt}. Award-winning design, highly detailed.` }] 
      },
      config: {
        imageConfig: {
          aspectRatio,
        }
      },
    });

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image part found");
  } catch (error) {
    console.error("Gemini Image API Error:", error);
    throw error;
  }
};

export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16' = '16:9', image?: { data: string, mimeType: string }): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt ? `Cinematic v4 music video: ${prompt}.` : undefined,
      image: image ? {
        imageBytes: image.data.split(',')[1],
        mimeType: image.mimeType
      } : undefined,
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed");

    const fetchResponse = await fetch(downloadLink, {
      method: 'GET',
      headers: {
        'x-goog-api-key': process.env.API_KEY as string,
      },
    });
    const blob = await fetchResponse.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Veo Video API Error:", error);
    throw error;
  }
};

/**
 * Generates a MIDI loop description using Gemini.
 * Returns a textual representation of MIDI events.
 */
export const generateMidiLoop = async (chords: string[], pattern: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a detailed MIDI sequence description for these chords: ${chords.join(', ')} using a ${pattern} pattern. Include note numbers, velocities, and timing offsets.`,
      config: {
        systemInstruction: "You are a professional MIDI composer and music theoretician. Provide technical MIDI event logs for DAW import.",
        temperature: 0.6,
      },
    });
    return response.text || "MIDI sequence generation failed.";
  } catch (error) {
    console.error("Gemini MIDI Error:", error);
    return "Error synthesizing MIDI sequence.";
  }
};
