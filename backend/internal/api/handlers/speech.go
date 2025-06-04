package handlers

import (
	"ai-bot-deecogs/internal/clients"
	"ai-bot-deecogs/internal/helpers"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Frontend request structures
type SpeechToTextRequest struct {
	AudioContent string `json:"audio_content"`
	LanguageCode string `json:"language_code"`
}

type TextToSpeechRequest struct {
	Text         string  `json:"text"`
	VoiceName    string  `json:"voice_name"`
	LanguageCode string  `json:"language_code"`
	SpeakingRate float64 `json:"speaking_rate"`
}

func SpeechToText(c *gin.Context) {
	var request SpeechToTextRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusBadRequest, nil, err)
		return
	}

	// Convert to Google API format
	googleRequest := map[string]interface{}{
		"config": map[string]interface{}{
			"encoding":                   "WEBM_OPUS",
			"sampleRateHertz":            48000,
			"languageCode":               request.LanguageCode,
			"enableAutomaticPunctuation": true,
			"model":                      "latest_long",
			"useEnhanced":                true,
		},
		"audio": map[string]interface{}{
			"content": request.AudioContent,
		},
	}

	result, err := clients.GetGoogleSpeechClient().SpeechToText(googleRequest)
	if err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, nil, err)
		return
	}

	// Extract transcript from Google response
	transcript := ""
	if results, ok := result["results"].([]interface{}); ok && len(results) > 0 {
		if firstResult, ok := results[0].(map[string]interface{}); ok {
			if alternatives, ok := firstResult["alternatives"].([]interface{}); ok && len(alternatives) > 0 {
				if alt, ok := alternatives[0].(map[string]interface{}); ok {
					if t, ok := alt["transcript"].(string); ok {
						transcript = t
					}
				}
			}
		}
	}

	// Return in expected format
	helpers.SendResponse(c.Writer, true, http.StatusOK, map[string]interface{}{
		"transcript": transcript,
	}, nil)
}

func TextToSpeech(c *gin.Context) {
	var request TextToSpeechRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusBadRequest, nil, err)
		return
	}

	// Convert to Google API format
	googleRequest := map[string]interface{}{
		"input": map[string]interface{}{
			"text": request.Text,
		},
		"voice": map[string]interface{}{
			"languageCode": request.LanguageCode,
			"name":         request.VoiceName,
		},
		"audioConfig": map[string]interface{}{
			"audioEncoding": "LINEAR16",
			"speakingRate":  request.SpeakingRate,
		},
	}

	result, err := clients.GetGoogleSpeechClient().TextToSpeech(googleRequest)
	if err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, nil, err)
		return
	}

	// Extract audio content
	audioContent := ""
	if ac, ok := result["audioContent"].(string); ok {
		audioContent = ac
	}

	// Return in expected format
	helpers.SendResponse(c.Writer, true, http.StatusOK, map[string]interface{}{
		"audio_content": audioContent,
	}, nil)
}
