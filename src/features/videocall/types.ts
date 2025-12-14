export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
}

export interface ChatMessage {
  id: number;
  author: string;
  text: string;
}
