import { useReducer, useCallback } from "react";

const modalReducer = (state, action) => {
  switch (action.type) {
    case 'OPEN_RESUME':
      return { ...state, resumeOpen: true };
    case 'CLOSE_RESUME':
      return { ...state, resumeOpen: false };
    case 'OPEN_VIDEO':
      return { ...state, videoModalUrl: action.payload };
    case 'CLOSE_VIDEO':
      return { ...state, videoModalUrl: null };
    case 'SET_AUDIO':
      return { 
        ...state, 
        audioUrl: action.payload.url, 
        isPlaying: action.payload.playing 
      };
    case 'TOGGLE_AUDIO':
      return { ...state, isPlaying: !state.isPlaying };
    default:
      return state;
  }
};

const initialState = {
  resumeOpen: false,
  videoModalUrl: null,
  audioUrl: null,
  isPlaying: false
};

export function useModal() {
  const [state, dispatch] = useReducer(modalReducer, initialState);

  const openResume = useCallback(() => dispatch({ type: 'OPEN_RESUME' }), []);
  const closeResume = useCallback(() => dispatch({ type: 'CLOSE_RESUME' }), []);
  const openVideo = useCallback((url) => dispatch({ type: 'OPEN_VIDEO', payload: url }), []);
  const closeVideo = useCallback(() => dispatch({ type: 'CLOSE_VIDEO' }), []);
  const setAudio = useCallback((url, playing = true) => 
    dispatch({ type: 'SET_AUDIO', payload: { url, playing } }), []);
  const toggleAudio = useCallback(() => dispatch({ type: 'TOGGLE_AUDIO' }), []);

  return {
    ...state,
    openResume,
    closeResume,
    openVideo,
    closeVideo,
    setAudio,
    toggleAudio
  };
}