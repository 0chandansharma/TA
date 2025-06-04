package handlers

import (
	"github.com/gin-gonic/gin"
)

// PosesHandler handles user login
func PosesHandler(c *gin.Context) {
    c.JSON(200, gin.H{
        "message": "PosesHandler successful",
    })
}
