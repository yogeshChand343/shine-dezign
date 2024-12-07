class ProductGallery extends HTMLElement {
  constructor() {
    super();
    this.featured_image = this.querySelector('[data-role="featured-image"]');
    this.thumb_images = this.querySelectorAll('[data-role="thumb-image"]');

    document.addEventListener("custom:updateGalleryImage", (e) => {
      console.log("event", e);
      const { imageSrc } = e.detail;
      this.featured_image ? (this.featured_image.src = imageSrc) : "";
    });
  }

  initalizeSlider(Slider) {
    console.log("loading slider");
  }
}

customElements.define("product-gallery", ProductGallery);

class DeffereMedia extends HTMLElement {
  constructor() {
    super();
    this.templateContent = this.querySelector("template").innerHTML;
    this.image = this.querySelector("img");
    this.observer.observe(this.image);
  }
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const intersecting = entry.isIntersecting;
      if (intersecting) {
        this.observer.unobserve(this.image);
        this.innerHTML = this.templateContent;
      }
    });
  });
}
customElements.define("deffered-media", DeffereMedia);
