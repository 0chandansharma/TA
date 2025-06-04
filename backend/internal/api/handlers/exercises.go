package handlers

import (
	"github.com/gin-gonic/gin"
)

// ExercisesHandler handles user login
func ExercisesHandler(c *gin.Context) {
    c.JSON(200, gin.H{
        "message": "ExercisesHandler successful",
    })
}
