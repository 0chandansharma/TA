package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"

	_ "ai-bot-deecogs/docs" // Import the Swagger docs
	"ai-bot-deecogs/internal/api"
	"ai-bot-deecogs/internal/db"

	"github.com/gin-contrib/cors"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title AI-Bot-DeeCogs API
// @version 1.0
// @description API documentation for AI-Bot-DeeCogs
// @host localhost:8080
// @BasePath /
func main() {

	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, loading environment variables from the system")
	}

	// Check if DATABASE_URL is set
	// if os.Getenv("DATABASE_URL") == "" {
	// 	log.Fatal("DATABASE_URL is not set")
	// }
	// Read DATABASE_URL
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}
	fmt.Println("Using database:", dbURL)

	r := gin.Default()

	// Add CORS middleware before routes
	allowedOrigins := []string{
		"http://localhost:3000",
		"http://localhost:3001", 
		"https://triage-frontend-844145949029.europe-west1.run.app",
	}
	
	// Add production origins from environment variable if available
	if prodOrigin := os.Getenv("ALLOWED_ORIGIN"); prodOrigin != "" {
		allowedOrigins = append(allowedOrigins, prodOrigin)
	}
	
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			// Additional validation for dynamic origins if needed
			for _, allowed := range allowedOrigins {
				if origin == allowed {
					return true
				}
			}
			return false
		},
		MaxAge: 12 * time.Hour,
	}))
	db.InitDB()
	defer db.CloseDB()

	db.PostgresVersion()

	// Swagger route
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Example route
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})

	api.SetupRoutes(r)

	log.Println("Starting server on http://localhost:8080")
	r.Run(":8080")
}
