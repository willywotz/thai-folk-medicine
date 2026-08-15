package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// HealerHandler serves the healer read and write endpoints.
type HealerHandler struct {
	service *usecase.HealerService
}

// NewHealerHandler builds the healer handler.
func NewHealerHandler(service *usecase.HealerService) *HealerHandler {
	return &HealerHandler{service: service}
}

// RegisterRoutes mounts the healer routes: reads public, writes JWT-guarded.
func (h *HealerHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/districts/:districtId/healers", h.ListByDistrict)
	public.GET("/healers", h.ListPage)
	public.GET("/healers/:healerId", h.Get)
	protected.POST("/healers", h.Create)
	protected.PUT("/healers/:healerId", h.Update)
	protected.DELETE("/healers/:healerId", h.Delete)
}

type healerDTO struct {
	ID          int64     `json:"id"`
	DistrictID  int64     `json:"districtId"`
	FullName    string    `json:"fullName"`
	SubDistrict string    `json:"subDistrict"`
	Specialty   string    `json:"specialty"`
	Biography   string    `json:"biography"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func toHealerDTO(h healer.Healer) healerDTO {
	return healerDTO{
		ID:          h.ID,
		DistrictID:  h.DistrictID,
		FullName:    h.FullName,
		SubDistrict: h.SubDistrict,
		Specialty:   h.Specialty,
		Biography:   h.Biography,
		CreatedAt:   h.CreatedAt,
		UpdatedAt:   h.UpdatedAt,
	}
}

type healerRequest struct {
	DistrictID  int64  `json:"districtId"`
	FullName    string `json:"fullName"`
	SubDistrict string `json:"subDistrict"`
	Specialty   string `json:"specialty"`
	Biography   string `json:"biography"`
}

// ListByDistrict handles GET /api/v1/districts/:districtId/healers?page&pageSize.
func (h *HealerHandler) ListByDistrict(c *gin.Context) {
	districtID, err := strconv.ParseInt(c.Param("districtId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "district id must be a number"})
		return
	}
	params, page, pageSize := parsePageParams(c, 12)
	result, err := h.service.ListByDistrictPage(c.Request.Context(), districtID, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list healers"})
		return
	}
	out := make([]healerDTO, 0, len(result.Items))
	for _, item := range result.Items {
		out = append(out, toHealerDTO(item))
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}

// ListPage handles GET /api/v1/healers?districtId&searchTerm&page&pageSize.
func (h *HealerHandler) ListPage(c *gin.Context) {
	var districtID *int64
	if raw := c.Query("districtId"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "district id must be a number"})
			return
		}
		districtID = &id
	}
	params, page, pageSize := parsePageParams(c, 12)
	result, err := h.service.List(c.Request.Context(), params, districtID, parseSearchTerm(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list healers"})
		return
	}
	out := make([]healerDTO, 0, len(result.Items))
	for _, item := range result.Items {
		out = append(out, toHealerDTO(item))
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}

// Get handles GET /api/v1/healers/:healerId.
func (h *HealerHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, healer.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "healer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read healer"})
		return
	}
	c.JSON(http.StatusOK, toHealerDTO(found))
}

// Create handles POST /api/v1/healers.
func (h *HealerHandler) Create(c *gin.Context) {
	var req healerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	created, err := h.service.Create(c.Request.Context(), healer.CreateParams{
		DistrictID:  req.DistrictID,
		FullName:    req.FullName,
		SubDistrict: req.SubDistrict,
		Specialty:   req.Specialty,
		Biography:   req.Biography,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidHealer) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "full name is required and district id must be valid"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create healer"})
		return
	}
	c.JSON(http.StatusCreated, toHealerDTO(created))
}

// Update handles PUT /api/v1/healers/:healerId.
func (h *HealerHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	var req healerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	updated, err := h.service.Update(c.Request.Context(), healer.UpdateParams{
		ID:          id,
		DistrictID:  req.DistrictID,
		FullName:    req.FullName,
		SubDistrict: req.SubDistrict,
		Specialty:   req.Specialty,
		Biography:   req.Biography,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidHealer):
			c.JSON(http.StatusBadRequest, gin.H{"error": "full name is required and district id must be valid"})
		case errors.Is(err, healer.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "healer not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot update healer"})
		}
		return
	}
	c.JSON(http.StatusOK, toHealerDTO(updated))
}

// Delete handles DELETE /api/v1/healers/:healerId.
func (h *HealerHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		switch {
		case errors.Is(err, healer.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "healer not found"})
		case errors.Is(err, healer.ErrReferenced):
			c.JSON(http.StatusConflict, gin.H{"error": "healer has remedies or cases; delete them first"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete healer"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}
