package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// RemedyReader lists remedies that use a herb (for the herb profile page).
type RemedyReader interface {
	ListByHerb(ctx context.Context, herbID int64) ([]remedy.Remedy, error)
}

// HerbHandler serves the herb read and write endpoints.
type HerbHandler struct {
	service      *usecase.HerbService
	remedyReader RemedyReader
}

// NewHerbHandler builds the herb handler.
func NewHerbHandler(service *usecase.HerbService, remedyReader RemedyReader) *HerbHandler {
	return &HerbHandler{service: service, remedyReader: remedyReader}
}

// RegisterRoutes mounts the herb routes: reads public, writes JWT-guarded.
func (h *HerbHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/herbs", h.List)
	public.GET("/herbs/:herbId", h.Get)
	public.GET("/herbs/:herbId/remedies", h.ListRemedies)
	protected.POST("/herbs", h.Create)
	protected.PUT("/herbs/:herbId", h.Update)
	protected.DELETE("/herbs/:herbId", h.Delete)
}

type herbDTO struct {
	ID             int64     `json:"id"`
	NameThai       string    `json:"nameThai"`
	NameEnglish    string    `json:"nameEnglish"`
	ScientificName string    `json:"scientificName"`
	Properties     string    `json:"properties"`
	Description    string    `json:"description"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func toHerbDTO(h herb.Herb) herbDTO {
	return herbDTO{
		ID:             h.ID,
		NameThai:       h.NameThai,
		NameEnglish:    h.NameEnglish,
		ScientificName: h.ScientificName,
		Properties:     h.Properties,
		Description:    h.Description,
		CreatedAt:      h.CreatedAt,
		UpdatedAt:      h.UpdatedAt,
	}
}

type herbRequest struct {
	NameThai       string `json:"nameThai"`
	NameEnglish    string `json:"nameEnglish"`
	ScientificName string `json:"scientificName"`
	Properties     string `json:"properties"`
	Description    string `json:"description"`
}

// List handles GET /api/v1/herbs.
func (h *HerbHandler) List(c *gin.Context) {
	list, err := h.service.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list herbs"})
		return
	}
	out := make([]herbDTO, 0, len(list))
	for _, item := range list {
		out = append(out, toHerbDTO(item))
	}
	c.JSON(http.StatusOK, out)
}

// Get handles GET /api/v1/herbs/:herbId.
func (h *HerbHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("herbId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "herb id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, herb.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "herb not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read herb"})
		return
	}
	c.JSON(http.StatusOK, toHerbDTO(found))
}

// ListRemedies handles GET /api/v1/herbs/:herbId/remedies.
func (h *HerbHandler) ListRemedies(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("herbId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "herb id must be a number"})
		return
	}
	list, err := h.remedyReader.ListByHerb(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list remedies for herb"})
		return
	}
	out := make([]remedyDTO, 0, len(list))
	for _, item := range list {
		out = append(out, toRemedyDTO(item))
	}
	c.JSON(http.StatusOK, out)
}

// Create handles POST /api/v1/herbs.
func (h *HerbHandler) Create(c *gin.Context) {
	var req herbRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	created, err := h.service.Create(c.Request.Context(), herb.CreateParams{
		NameThai:       req.NameThai,
		NameEnglish:    req.NameEnglish,
		ScientificName: req.ScientificName,
		Properties:     req.Properties,
		Description:    req.Description,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidHerb) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "thai name is required"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create herb"})
		return
	}
	c.JSON(http.StatusCreated, toHerbDTO(created))
}

// Update handles PUT /api/v1/herbs/:herbId.
func (h *HerbHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("herbId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "herb id must be a number"})
		return
	}
	var req herbRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	updated, err := h.service.Update(c.Request.Context(), herb.UpdateParams{
		ID:             id,
		NameThai:       req.NameThai,
		NameEnglish:    req.NameEnglish,
		ScientificName: req.ScientificName,
		Properties:     req.Properties,
		Description:    req.Description,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidHerb):
			c.JSON(http.StatusBadRequest, gin.H{"error": "thai name is required"})
		case errors.Is(err, herb.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "herb not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot update herb"})
		}
		return
	}
	c.JSON(http.StatusOK, toHerbDTO(updated))
}

// Delete handles DELETE /api/v1/herbs/:herbId.
func (h *HerbHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("herbId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "herb id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, herb.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "herb not found"})
		case errors.Is(err, herb.ErrReferenced):
			c.JSON(http.StatusConflict, gin.H{"error": "herb is used by remedies; unlink them first"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete herb"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}
