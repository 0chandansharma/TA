package api

import (
	"log"

	"github.com/gin-gonic/gin"
)

// StartServer initializes and starts the HTTP server
func StartServer() error {
	r := gin.Default()

	// Example route
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	log.Println("Server is running on http://localhost:8080")
	return r.Run(":8080") // Start the server on port 8080
}
