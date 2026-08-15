package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/audit"
	audituc "github.com/willywotz/thai-folk-medicine/backend/internal/usecase/audit"
)

// ActivityHandler serves the persisted-event activity feed.
type ActivityHandler struct {
	reader *audituc.Reader
}

// NewActivityHandler builds the activity handler.
func NewActivityHandler(reader *audituc.Reader) *ActivityHandler {
	return &ActivityHandler{reader: reader}
}

// RegisterRoutes mounts the activity route: JWT-guarded, no reads without auth.
func (h *ActivityHandler) RegisterRoutes(_, protected *gin.RouterGroup) {
	protected.GET("/activity", h.List)
}

type activityDTO struct {
	ID         int64           `json:"id"`
	EventName  string          `json:"eventName"`
	OccurredAt time.Time       `json:"occurredAt"`
	Payload    json.RawMessage `json:"payload"`
}

func toActivityDTO(e audit.Entry) activityDTO {
	return activityDTO{ID: e.ID, EventName: e.EventName, OccurredAt: e.OccurredAt, Payload: e.Payload}
}

// List handles GET /api/v1/activity?page&pageSize.
func (h *ActivityHandler) List(c *gin.Context) {
	params, page, pageSize := parsePageParams(c, 12)
	result, err := h.reader.List(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list activity"})
		return
	}
	out := make([]activityDTO, 0, len(result.Items))
	for _, e := range result.Items {
		out = append(out, toActivityDTO(e))
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}
