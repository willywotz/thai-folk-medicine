package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// StatsHandler serves the aggregate row totals for the staff dashboard.
type StatsHandler struct {
	service *usecase.StatsService
}

// NewStatsHandler builds the stats handler.
func NewStatsHandler(service *usecase.StatsService) *StatsHandler {
	return &StatsHandler{service: service}
}

// RegisterRoutes mounts the stats route: JWT-guarded, no reads without auth.
func (h *StatsHandler) RegisterRoutes(_, protected *gin.RouterGroup) {
	protected.GET("/stats", h.Get)
}

type statsDTO struct {
	Provinces int `json:"provinces"`
	Districts int `json:"districts"`
	Healers   int `json:"healers"`
	Remedies  int `json:"remedies"`
	Cases     int `json:"cases"`
	Herbs     int `json:"herbs"`
}

// Get handles GET /api/v1/stats.
func (h *StatsHandler) Get(c *gin.Context) {
	stats, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot load stats"})
		return
	}
	c.JSON(http.StatusOK, statsDTO{
		Provinces: stats.Provinces, Districts: stats.Districts, Healers: stats.Healers,
		Remedies: stats.Remedies, Cases: stats.Cases, Herbs: stats.Herbs,
	})
}
