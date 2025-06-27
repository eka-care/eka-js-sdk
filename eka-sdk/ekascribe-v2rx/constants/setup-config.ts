import { TEMPLATE_ID } from './enums';

export const SUPPORTED_LANGUAGES = [
  { id: 'en-IN', name: 'English (India)' },
  { id: 'en-US', name: 'English (United States)' },
  { id: 'hi', name: 'Hindi' },
  { id: 'gu', name: 'Gujarati' },
  { id: 'kn', name: 'Kannada' },
  { id: 'ml', name: 'Malayalam' },
  { id: 'ta', name: 'Tamil' },
  { id: 'te', name: 'Telugu' },
  { id: 'bn', name: 'Bengali' },
  { id: 'mr', name: 'Marathi' },
  { id: 'pa', name: 'Punjabi' },
];

export const SUPPORTED_OUTPUT_FORMATS = [
  { id: TEMPLATE_ID.EKA_EMR_TEMPLATE, name: 'Eka EMR Format' },
  { id: TEMPLATE_ID.CLINICAL_NOTE_TEMPLATE, name: 'Clinical Notes' },
  { id: TEMPLATE_ID.TRANSCRIPT_TEMPLATE, name: 'Transcription' },
];

export const CONSULTATION_MODES = [
  {
    id: 'consultation',
    name: 'Consultation',
    desc: 'Eka Scribe will listen to your conversation and create clinical notes',
  },
  {
    id: 'dictation',
    name: 'Dictation',
    desc: 'Dictate your notes to Eka Scribe and create clinical notes',
  },
];
