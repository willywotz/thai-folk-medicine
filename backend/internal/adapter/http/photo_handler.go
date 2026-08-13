package httpapi

import (
	"errors"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

// PhotoHandler serves photo upload, serve, and delete.
type PhotoHandler struct {
	service *usecase.PhotoService
}

// NewPhotoHandler builds the photo handler.
func NewPhotoHandler(service *usecase.PhotoService) *PhotoHandler {
	return &PhotoHandler{service: service}
}

// RegisterRoutes mounts the photo routes: serve public, upload/delete guarded.
func (h *PhotoHandler) RegisterRoutes(public, protected *gin.RouterGroup) {
	public.GET("/photos/:photoId", h.Serve)
	protected.POST("/photos", h.Upload)
	protected.DELETE("/photos/:photoId", h.Delete)
}

type photoDTO struct {
	ID        int64  `json:"id"`
	OwnerType string `json:"ownerType"`
	OwnerID   int64  `json:"ownerId"`
	Caption   string `json:"caption"`
}

func toPhotoDTO(p photo.Photo) photoDTO {
	return photoDTO{ID: p.ID, OwnerType: p.OwnerType, OwnerID: p.OwnerID, Caption: p.Caption}
}

// Upload handles POST /api/v1/photos (multipart: file, ownerType, ownerId, caption).
func (h *PhotoHandler) Upload(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a file is required"})
		return
	}
	ownerType := c.PostForm("ownerType")
	ownerID, err := strconv.ParseInt(c.PostForm("ownerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ownerId must be a number"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read the file"})
		return
	}
	defer file.Close()

	ext := filepath.Ext(fileHeader.Filename)
	created, err := h.service.Upload(c.Request.Context(), ownerType, ownerID, file, ext, c.PostForm("caption"))
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidPhoto) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ownerType must be healer|remedy|case and ownerId must be valid"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot store the photo"})
		return
	}
	c.JSON(http.StatusCreated, toPhotoDTO(created))
}

// Serve handles GET /api/v1/photos/:photoId (streams the bytes).
func (h *PhotoHandler) Serve(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("photoId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo id must be a number"})
		return
	}
	found, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, photo.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "photo not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot read photo"})
		return
	}
	rc, err := h.service.OpenFile(c.Request.Context(), found)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot open photo file"})
		return
	}
	defer rc.Close()

	contentType := mimeByExt(filepath.Ext(found.ObjectKey))
	c.DataFromReader(http.StatusOK, -1, contentType, rc, nil)
}

// Delete handles DELETE /api/v1/photos/:photoId.
func (h *PhotoHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("photoId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo id must be a number"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, photo.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "photo not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot delete photo"})
		return
	}
	c.Status(http.StatusNoContent)
}

// mimeByExt maps a file extension to a content type for common image formats.
func mimeByExt(ext string) string {
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "application/octet-stream"
	}
}
