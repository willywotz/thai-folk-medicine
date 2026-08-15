package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase/search"
)

// SearchHandler serves the public search endpoint.
type SearchHandler struct {
	service *search.Service
}

// NewSearchHandler builds the search handler.
func NewSearchHandler(service *search.Service) *SearchHandler {
	return &SearchHandler{service: service}
}

// RegisterRoutes mounts the public search route.
func (h *SearchHandler) RegisterRoutes(public, _ *gin.RouterGroup) {
	public.GET("/search", h.Search)
}

type searchHitDTO struct {
	Type     string  `json:"type"`
	ID       int64   `json:"id"`
	Title    string  `json:"title"`
	Subtitle string  `json:"subtitle"`
	Score    float64 `json:"score"`
}

// Search handles GET /api/v1/search.
func (h *SearchHandler) Search(c *gin.Context) {
	params, page, pageSize := parsePageParams(c, 20)
	result, err := h.service.Search(c.Request.Context(), c.Query("searchTerm"), params)
	if err != nil {
		if errors.Is(err, search.ErrTermTooShort) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "search term must be at least two characters"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot run search"})
		return
	}
	out := make([]searchHitDTO, 0, len(result.Items))
	for _, hit := range result.Items {
		out = append(out, searchHitDTO{hit.Type, hit.ID, hit.Title, hit.Subtitle, hit.Score})
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}
