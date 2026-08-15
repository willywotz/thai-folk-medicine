package httpapi

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// LocationHandler serves the province and district read endpoints.
type LocationHandler struct {
	service *usecase.LocationService
}

// NewLocationHandler builds the location handler.
func NewLocationHandler(service *usecase.LocationService) *LocationHandler {
	return &LocationHandler{service: service}
}

// RegisterRoutes mounts the province and district read routes (all public).
func (h *LocationHandler) RegisterRoutes(public, _ *gin.RouterGroup) {
	public.GET("/provinces", h.ListProvince)
	public.GET("/provinces/:provinceId/districts", h.ListDistrictByProvince)
	public.GET("/districts/:districtId", h.GetDistrict)
}

type provinceDTO struct {
	ID          int64  `json:"id"`
	NameThai    string `json:"nameThai"`
	NameEnglish string `json:"nameEnglish"`
}

type districtDTO struct {
	ID          int64  `json:"id"`
	ProvinceID  int64  `json:"provinceId"`
	NameThai    string `json:"nameThai"`
	NameEnglish string `json:"nameEnglish"`
}

// ListProvince handles GET /api/v1/provinces.
func (h *LocationHandler) ListProvince(c *gin.Context) {
	provinces, err := h.service.ListProvince(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list provinces"})
		return
	}

	out := make([]provinceDTO, 0, len(provinces))
	for _, p := range provinces {
		out = append(out, provinceDTO(p))
	}
	c.JSON(http.StatusOK, out)
}

// ListDistrictByProvince handles GET /api/v1/provinces/:provinceId/districts.
func (h *LocationHandler) ListDistrictByProvince(c *gin.Context) {
	provinceID, err := strconv.ParseInt(c.Param("provinceId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "province id must be a number"})
		return
	}

	districts, err := h.service.ListDistrictByProvince(c.Request.Context(), provinceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list districts"})
		return
	}

	out := make([]districtDTO, 0, len(districts))
	for _, d := range districts {
		out = append(out, districtDTO(d))
	}
	c.JSON(http.StatusOK, out)
}

// GetDistrict handles GET /api/v1/districts/:districtId.
func (h *LocationHandler) GetDistrict(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("districtId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "district id must be a number"})
		return
	}

	district, err := h.service.GetDistrict(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, location.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "district not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot get district"})
		return
	}

	c.JSON(http.StatusOK, districtDTO(district))
}
