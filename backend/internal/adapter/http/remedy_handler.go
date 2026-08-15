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

// RegisterRoutes mounts the remedy routes: reads public, writes JWT-guarded.
func (h *RemedyHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/healers/:healerId/remedies", h.ListByHealer)
	public.GET("/remedies", h.ListPage)
	public.GET("/remedies/:remedyId", h.Get)
	protected.POST("/remedies", h.Create)
	protected.PUT("/remedies/:remedyId", h.Update)
	protected.DELETE("/remedies/:remedyId", h.Delete)
}

type remedyHerbDTO struct {
	HerbID      int64  `json:"herbId"`
	NameThai    string `json:"nameThai"`
	NameEnglish string `json:"nameEnglish"`
	Amount      string `json:"amount"`
}

type remedyHerbRequest struct {
	HerbID int64  `json:"herbId"`
	Amount string `json:"amount"`
}

type remedyDTO struct {
	ID                int64           `json:"id"`
	HealerID          int64           `json:"healerId"`
	Name              string          `json:"name"`
	Symptoms          string          `json:"symptoms"`
	PreparationMethod string          `json:"preparationMethod"`
	Usage             string          `json:"usage"`
	Note              string          `json:"note"`
	Herbs             []remedyHerbDTO `json:"herbs"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
}

func toRemedyDTO(r remedy.Remedy) remedyDTO {
	herbs := make([]remedyHerbDTO, 0, len(r.Herbs))
	for _, l := range r.Herbs {
		herbs = append(herbs, remedyHerbDTO{HerbID: l.HerbID, NameThai: l.NameThai, NameEnglish: l.NameEnglish, Amount: l.Amount})
	}
	return remedyDTO{
		ID:                r.ID,
		HealerID:          r.HealerID,
		Name:              r.Name,
		Symptoms:          r.Symptoms,
		PreparationMethod: r.PreparationMethod,
		Usage:             r.Usage,
		Note:              r.Note,
		Herbs:             herbs,
		CreatedAt:         r.CreatedAt,
		UpdatedAt:         r.UpdatedAt,
	}
}

type remedyRequest struct {
	HealerID          int64               `json:"healerId"`
	Name              string              `json:"name"`
	Symptoms          string              `json:"symptoms"`
	PreparationMethod string              `json:"preparationMethod"`
	Usage             string              `json:"usage"`
	Note              string              `json:"note"`
	Herbs             []remedyHerbRequest `json:"herbs"`
}

func toHerbRefs(req []remedyHerbRequest) []remedy.HerbRef {
	refs := make([]remedy.HerbRef, 0, len(req))
	for _, h := range req {
		refs = append(refs, remedy.HerbRef{HerbID: h.HerbID, Amount: h.Amount})
	}
	return refs
}

// ListByHealer handles GET /api/v1/healers/:healerId/remedies?page&pageSize.
func (h *RemedyHandler) ListByHealer(c *gin.Context) {
	healerID, err := strconv.ParseInt(c.Param("healerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "healer id must be a number"})
		return
	}
	params, page, pageSize := parsePageParams(c, 12)
	result, err := h.service.ListByHealerPage(c.Request.Context(), healerID, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list remedies"})
		return
	}
	out := make([]remedyDTO, 0, len(result.Items))
	for _, item := range result.Items {
		out = append(out, toRemedyDTO(item))
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}

// ListPage handles GET /api/v1/remedies?page&pageSize.
func (h *RemedyHandler) ListPage(c *gin.Context) {
	params, page, pageSize := parsePageParams(c, 12)
	result, err := h.service.ListPage(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list remedies"})
		return
	}
	out := make([]remedyDTO, 0, len(result.Items))
	for _, r := range result.Items {
		out = append(out, toRemedyDTO(r))
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
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
		PreparationMethod: req.PreparationMethod,
		Usage:             req.Usage,
		Note:              req.Note,
		Herbs:             toHerbRefs(req.Herbs),
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
		HealerID:          req.HealerID,
		Name:              req.Name,
		Symptoms:          req.Symptoms,
		PreparationMethod: req.PreparationMethod,
		Usage:             req.Usage,
		Note:              req.Note,
		Herbs:             toHerbRefs(req.Herbs),
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidRemedy):
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required and healer id must be valid"})
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
