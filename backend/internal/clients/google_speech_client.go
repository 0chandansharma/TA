// backend/internal/clients/google_speech_client.go
package clients

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

var googleSpeechClient *GoogleSpeechClient

type GoogleSpeechClient struct {
	apiKey      string
	projectID   string
	sttEndpoint string
	ttsEndpoint string
	httpClient  *http.Client
}

// GetGoogleSpeechClient returns a singleton instance of GoogleSpeechClient
func GetGoogleSpeechClient() *GoogleSpeechClient {
	if googleSpeechClient == nil {
		apiKey := os.Getenv("GOOGLE_CLOUD_API_KEY")
		if apiKey == "" {
			fmt.Printf("Warning: GOOGLE_CLOUD_API_KEY not set\n")
		}

		projectID := os.Getenv("GOOGLE_CLOUD_PROJECT_ID")
		if projectID == "" {
			projectID = "dochq-staging"
		}

		googleSpeechClient = &GoogleSpeechClient{
			apiKey:      apiKey,
			projectID:   projectID,
			sttEndpoint: "https://speech.googleapis.com/v1/speech:recognize",
			ttsEndpoint: "https://texttospeech.googleapis.com/v1/text:synthesize",
			httpClient:  &http.Client{},
		}
	}
	return googleSpeechClient
}

// SpeechToText converts audio to text using Google Speech-to-Text API
func (c *GoogleSpeechClient) SpeechToText(request interface{}) (map[string]interface{}, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("GOOGLE_CLOUD_API_KEY not set")
	}

	// Convert request to JSON
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request with API key
	url := fmt.Sprintf("%s?key=%s", c.sttEndpoint, c.apiKey)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Make the request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Log response for debugging
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Google Speech API error response: %s\n", string(body))

		if resp.StatusCode == 403 {
			return nil, fmt.Errorf("permission denied - enable Speech API in Google Cloud Console")
		}

		return nil, fmt.Errorf("Google Speech API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return result, nil
}

// TextToSpeech converts text to audio using Google Text-to-Speech API
func (c *GoogleSpeechClient) TextToSpeech(request interface{}) (map[string]interface{}, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("GOOGLE_CLOUD_API_KEY not set")
	}

	// Convert request to JSON
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request with API key
	url := fmt.Sprintf("%s?key=%s", c.ttsEndpoint, c.apiKey)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Make the request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check for errors
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Google TTS API error response: %s\n", string(body))

		if resp.StatusCode == 403 {
			return nil, fmt.Errorf("permission denied - enable Text-to-Speech API in Google Cloud Console")
		}

		return nil, fmt.Errorf("Google TTS API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return result, nil
}
