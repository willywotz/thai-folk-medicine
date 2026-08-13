package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// RemedyHandler serves the remedy read and write endpoints.
type RemedyHandler struct {
	service *usecase.RemedyService
}

// NewRemedyHandler builds the remedy handler.
func NewRemedyHandler(service *usecase.RemedyService) *RemedyHandler {
	return &RemedyHandler{service: service}
}

// RegisterRoutes mounts the remedy routes.
func (h *RemedyHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/healers/:healerId/remedies", h.ListByHealer)
	rg.GET("/remedies/:remedyId", h.Get)
	// withinlazy: unguarded until Plan 4 adds JWT middleware on the write routes.
	rg.POST("/remedies", h.Create)
	rg.PUT("/remedies/:remedyId", h.Update)
	rg.DELETE("/remedies/:remedyId", h.Delete)
}

type remedyDTO struct {
	ID                int64     `json:"id"`
	HealerID          int64     `json:"healerId"`
	Name              string    `json:"name"`
	Symptoms          string    `json:"symptoms"`
	Ingredients       string    `json:"ingredients"`
	PreparationMethod string    `json:"preparationMethod"`
	Usage             string    `json:"usage"`
	Note              string    `json:"note"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

func toRemedyDTO(r remedy.Remedy) remedyDTO {
	return remedyDTO{
		ID:                r.ID,
		HealerID:          r.HealerID,
		Name:              r.Name,
		Symptoms:          r.Symptoms,
		Ingredients:       r.Ingredients,
		PreparationMethod: r.PreparationMethod,
		Usage:             r.Usage,
		Note:              r.Note,
		CreatedAt:         r.CreatedAt,
		UpdatedAt:         r.UpdatedAt,
	}
}

type remedyRequest struct {
	HealerID          int64  `json:"healerId"`
	Name              string `json:"name"`
	Symptoms          string `json:"symptoms"`
	Ingredients       string `json:"ingredients"`
	PreparationMethod string `json:"preparationMethod"`
	Usage             string `json:"usage"`
	Note              string `json:"note"`
}

// ListByHealer handles GET /api/v1/healers/:healerId/remedies.
func (h *RemedyHandler) ListByHealer(c *gin.Context) {
	healerID, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	list, err := h.service.ListByHealer(c.Request.Context(), healerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list remedies"})
		return
	}
	out := make([]remedyDTO, 0, len(list))
	for _, item := range list {
		out = append(out, toRemedyDTO(item))
	}
	c.JSON(http.StatusOK, out)
}

// Get handles GET /api/v1/remedies/:remedyId.
func (h *RemedyHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("remedyId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remedy id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, remedy.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "remedy not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read remedy"})
		return
	}
	c.JSON(http.StatusOK, toRemedyDTO(found))
}

// Create handles POST /api/v1/remedies.
func (h *RemedyHandler) Create(c *gin.Context) {
	var req remedyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	created, err := h.service.Create(c.Request.Context(), remedy.CreateParams{
		HealerID:          req.HealerID,
		Name:              req.Name,
		Symptoms:          req.Symptoms,
		Ingredients:       req.Ingredients,
		PreparationMethod: req.PreparationMethod,
		Usage:             req.Usage,
		Note:              req.Note,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidRemedy) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required and healer id must be valid"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create remedy"})
		return
	}
	c.JSON(http.StatusCreated, toRemedyDTO(created))
}

// Update handles PUT /api/v1/remedies/:remedyId.
func (h *RemedyHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("remedyId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remedy id must be a number"})
		return
	}
	var req remedyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	updated, err := h.service.Update(c.Request.Context(), remedy.UpdateParams{
		ID:                id,
		Name:              req.Name,
		Symptoms:          req.Symptoms,
		Ingredients:       req.Ingredients,
		PreparationMethod: req.PreparationMethod,
		Usage:             req.Usage,
		Note:              req.Note,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidRemedy):
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		case errors.Is(err, remedy.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "remedy not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot update remedy"})
		}
		return
	}
	c.JSON(http.StatusOK, toRemedyDTO(updated))
}

// Delete handles DELETE /api/v1/remedies/:remedyId.
func (h *RemedyHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("remedyId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remedy id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, remedy.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "remedy not found"})
		case errors.Is(err, remedy.ErrReferenced):
			c.JSON(http.StatusConflict, gin.H{"error": "remedy has treatment cases; delete them first"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete remedy"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}
