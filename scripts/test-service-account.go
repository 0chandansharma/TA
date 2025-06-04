// test-service-account.go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"golang.org/x/oauth2/google"
)

func main() {
	// Set credentials path
	credsPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if credsPath == "" {
		log.Fatal("GOOGLE_APPLICATION_CREDENTIALS not set")
	}

	// Read the credentials file
	credsJSON, err := os.ReadFile(credsPath)
	if err != nil {
		log.Fatalf("Failed to read credentials: %v", err)
	}

	// Parse credentials
	creds, err := google.CredentialsFromJSON(context.Background(), credsJSON,
		"https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		log.Fatalf("Failed to parse credentials: %v", err)
	}

	// Get project ID from credentials
	fmt.Printf("Project ID: %s\n", creds.ProjectID)

	// Get token to verify authentication
	token, err := creds.TokenSource.Token()
	if err != nil {
		log.Fatalf("Failed to get token: %v", err)
	}

	fmt.Printf("Token obtained successfully!\n")
	fmt.Printf("Token expires at: %v\n", token.Expiry)
}
