// handlers/google_speech.go
package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"

	speech "cloud.google.com/go/speech/apiv1"
	texttospeech "cloud.google.com/go/texttospeech/apiv1"
	"cloud.google.com/go/texttospeech/apiv1/texttospeechpb"
	"google.golang.org/api/option"
	speechpb "google.golang.org/genproto/googleapis/cloud/speech/v1"
)

type SpeechToTextRequest struct {
	AudioContent string `json:"audio_content"`
	LanguageCode string `json:"language_code"`
}

type SpeechToTextResponse struct {
	Transcript string `json:"transcript"`
}

type TextToSpeechRequest struct {
	Text         string  `json:"text"`
	VoiceName    string  `json:"voice_name"`
	LanguageCode string  `json:"language_code"`
	SpeakingRate float64 `json:"speaking_rate"`
}

type TextToSpeechResponse struct {
	AudioContent string `json:"audio_content"`
}

// SpeechToTextHandler handles speech to text conversion
func SpeechToTextHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var req SpeechToTextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create client with service account
	client, err := speech.NewClient(ctx, option.WithCredentialsFile("./dochq-staging-72db3155a22d.json"))
	if err != nil {
		http.Error(w, "Failed to create client: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Decode audio content
	audioBytes, err := base64.StdEncoding.DecodeString(req.AudioContent)
	if err != nil {
		http.Error(w, "Failed to decode audio: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Configure recognition request
	recognitionReq := &speechpb.RecognizeRequest{
		Config: &speechpb.RecognitionConfig{
			Encoding:                   speechpb.RecognitionConfig_WEBM_OPUS,
			SampleRateHertz:            48000,
			LanguageCode:               req.LanguageCode,
			EnableAutomaticPunctuation: true,
			Model:                      "latest_long",
			UseEnhanced:                true,
		},
		Audio: &speechpb.RecognitionAudio{
			AudioSource: &speechpb.RecognitionAudio_Content{
				Content: audioBytes,
			},
		},
	}

	// Perform recognition
	resp, err := client.Recognize(ctx, recognitionReq)
	if err != nil {
		http.Error(w, "Recognition failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	transcript := ""
	for _, result := range resp.Results {
		if len(result.Alternatives) > 0 {
			transcript += result.Alternatives[0].Transcript + " "
		}
	}

	// Send response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SpeechToTextResponse{
		Transcript: transcript,
	})
}

// TextToSpeechHandler handles text to speech conversion
func TextToSpeechHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var req TextToSpeechRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create client with service account
	client, err := texttospeech.NewClient(ctx, option.WithCredentialsFile("./dochq-staging-72db3155a22d.json"))
	if err != nil {
		http.Error(w, "Failed to create client: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Configure synthesis request with Chirp voice
	synthesisReq := &texttospeechpb.SynthesizeSpeechRequest{
		Input: &texttospeechpb.SynthesisInput{
			InputSource: &texttospeechpb.SynthesisInput_Text{
				Text: req.Text,
			},
		},
		Voice: &texttospeechpb.VoiceSelectionParams{
			LanguageCode: req.LanguageCode,
			Name:         req.VoiceName,
		},
		AudioConfig: &texttospeechpb.AudioConfig{
			AudioEncoding: texttospeechpb.AudioEncoding_LINEAR16,
			SpeakingRate:  req.SpeakingRate,
		},
	}

	// Perform synthesis
	resp, err := client.SynthesizeSpeech(ctx, synthesisReq)
	if err != nil {
		http.Error(w, "Synthesis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Send response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TextToSpeechResponse{
		AudioContent: base64.StdEncoding.EncodeToString(resp.AudioContent),
	})
}
