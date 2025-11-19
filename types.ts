export type Language = 'en' | 'zh';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isTyping?: boolean;
  sources?: Array<{
    uri: string;
    title: string;
  }>;
}

export interface Recipe {
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  tips: string;
}

export interface GeneratedImage {
  url: string;
  prompt: string;
}