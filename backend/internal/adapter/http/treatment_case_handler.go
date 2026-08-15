package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

const dateLayout = "2006-01-02"

// TreatmentCaseHandler serves the treatment-case read and write endpoints.
type TreatmentCaseHandler struct {
	service *usecase.TreatmentCaseService
}

// NewTreatmentCaseHandler builds the treatment-case handler.
func NewTreatmentCaseHandler(service *usecase.TreatmentCaseService) *TreatmentCaseHandler {
	return &TreatmentCaseHandler{service: service}
}

// RegisterRoutes mounts the treatment-case routes: reads public, writes JWT-guarded.
func (h *TreatmentCaseHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/remedies/:remedyId/treatment-cases", h.ListByRemedy)
	public.GET("/treatment-cases", h.ListPage)
	public.GET("/treatment-cases/:treatmentCaseId", h.Get)
	protected.POST("/treatment-cases", h.Create)
	protected.PUT("/treatment-cases/:treatmentCaseId", h.Update)
	protected.DELETE("/treatment-cases/:treatmentCaseId", h.Delete)
}

type treatmentCaseDTO struct {
	ID         int64  `json:"id"`
	RemedyID   int64  `json:"remedyId"`
	HealerID   int64  `json:"healerId"`
	PatientAge int    `json:"patientAge"`
	PatientSex string `json:"patientSex"`
	Symptoms   string `json:"symptoms"`
	Result     string `json:"result"`
	Note       string `json:"note"`
	TreatedOn  string `json:"treatedOn"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

func toTreatmentCaseDTO(c treatmentcase.TreatmentCase) treatmentCaseDTO {
	return treatmentCaseDTO{
		ID:         c.ID,
		RemedyID:   c.RemedyID,
		HealerID:   c.HealerID,
		PatientAge: c.PatientAge,
		PatientSex: c.PatientSex,
		Symptoms:   c.Symptoms,
		Result:     c.Result,
		Note:       c.Note,
		TreatedOn:  c.TreatedOn.Format(dateLayout),
		CreatedAt:  c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  c.UpdatedAt.Format(time.RFC3339),
	}
}

type treatmentCaseRequest struct {
	RemedyID   int64  `json:"remedyId"`
	HealerID   int64  `json:"healerId"`
	PatientAge int    `json:"patientAge"`
	PatientSex string `json:"patientSex"`
	Symptoms   string `json:"symptoms"`
	Result     string `json:"result"`
	Note       string `json:"note"`
	TreatedOn  string `json:"treatedOn"`
}

// ListByRemedy handles GET /api/v1/remedies/:remedyId/treatment-cases?page&pageSize.
func (h *TreatmentCaseHandler) ListByRemedy(c *gin.Context) {
	remedyID, err := strconv.ParseInt(c.Param("remedyId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remedy id must be a number"})
		return
	}
	params, page, pageSize := parsePageParams(c, 12)
	result, err := h.service.ListByRemedyPage(c.Request.Context(), remedyID, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list treatment cases"})
		return
	}
	out := make([]treatmentCaseDTO, 0, len(result.Items))
	for _, item := range result.Items {
		out = append(out, toTreatmentCaseDTO(item))
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}

// ListPage handles GET /api/v1/treatment-cases?page&pageSize.
func (h *TreatmentCaseHandler) ListPage(c *gin.Context) {
	params, page, pageSize := parsePageParams(c, 12)
	result, err := h.service.ListPage(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list treatment cases"})
		return
	}
	out := make([]treatmentCaseDTO, 0, len(result.Items))
	for _, item := range result.Items {
		out = append(out, toTreatmentCaseDTO(item))
	}
	c.JSON(http.StatusOK, newPageDTO(out, page, pageSize, result.Total))
}

// Get handles GET /api/v1/treatment-cases/:treatmentCaseId.
func (h *TreatmentCaseHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("treatmentCaseId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatment case id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, treatmentcase.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "treatment case not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read treatment case"})
		return
	}
	c.JSON(http.StatusOK, toTreatmentCaseDTO(found))
}

// Create handles POST /api/v1/treatment-cases.
func (h *TreatmentCaseHandler) Create(c *gin.Context) {
	var req treatmentCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	treatedOn, err := time.Parse(dateLayout, req.TreatedOn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatedOn must be a date like 2006-01-02"})
		return
	}
	created, err := h.service.Create(c.Request.Context(), treatmentcase.CreateParams{
		RemedyID:   req.RemedyID,
		HealerID:   req.HealerID,
		PatientAge: req.PatientAge,
		PatientSex: req.PatientSex,
		Symptoms:   req.Symptoms,
		Result:     req.Result,
		Note:       req.Note,
		TreatedOn:  treatedOn,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidTreatmentCase) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "remedyId, healerId, patientSex are required and patientAge must be >= 0"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create treatment case"})
		return
	}
	c.JSON(http.StatusCreated, toTreatmentCaseDTO(created))
}

// Update handles PUT /api/v1/treatment-cases/:treatmentCaseId.
func (h *TreatmentCaseHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("treatmentCaseId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatment case id must be a number"})
		return
	}
	var req treatmentCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	treatedOn, err := time.Parse(dateLayout, req.TreatedOn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatedOn must be a date like 2006-01-02"})
		return
	}
	updated, err := h.service.Update(c.Request.Context(), treatmentcase.UpdateParams{
		ID:         id,
		PatientAge: req.PatientAge,
		PatientSex: req.PatientSex,
		Symptoms:   req.Symptoms,
		Result:     req.Result,
		Note:       req.Note,
		TreatedOn:  treatedOn,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrInvalidTreatmentCase):
			c.JSON(http.StatusBadRequest, gin.H{"error": "patientSex is required and patientAge must be >= 0"})
		case errors.Is(err, treatmentcase.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "treatment case not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot update treatment case"})
		}
		return
	}
	c.JSON(http.StatusOK, toTreatmentCaseDTO(updated))
}

// Delete handles DELETE /api/v1/treatment-cases/:treatmentCaseId.
func (h *TreatmentCaseHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("treatmentCaseId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "treatment case id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, treatmentcase.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "treatment case not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete treatment case"})
		return
	}
	c.Status(http.StatusNoContent)
}
