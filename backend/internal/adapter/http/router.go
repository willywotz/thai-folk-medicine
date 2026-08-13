// Package httpapi holds the Gin router, handlers, and data transfer objects.
package httpapi

import "github.com/gin-gonic/gin"

// NewRouter builds the Gin engine and registers all routes.
func NewRouter(location *LocationHandler) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.GET("/health", Health)

	v1 := r.Group("/api/v1")
	{
		v1.GET("/provinces", location.ListProvince)
		v1.GET("/provinces/:provinceId/districts", location.ListDistrictByProvince)
	}
	return r
}
