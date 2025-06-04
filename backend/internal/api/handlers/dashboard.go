package handlers

import (
	"github.com/gin-gonic/gin"
)

// DashboardHandler handles user login
func DashboardHandler(c *gin.Context) {
    c.JSON(200, gin.H{
        "message": "DashboardHandler successful",
    })
}
