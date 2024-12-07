class QuantityInputNew extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('[data-role="quantity"]');
    this.decButton = this.querySelector('[data-role="decrement"]');
    this.incButton = this.querySelector('[data-role="increment"]');
    this.qtyInput = this.closest("product-form").querySelector(
      'input[name="quantity"]'
    );

    this.decButton.addEventListener("click", this.decrementQty.bind(this));
    this.incButton.addEventListener("click", this.incrementQty.bind(this));
  }
  incrementQty(e) {
    e.preventDefault();
    this.input.stepUp();
    this.qtyInput ? (this.qtyInput.value = this.input.value) : "";
  }
  decrementQty(e) {
    e.preventDefault();
    let currentValue = Number(this.input.value);
    currentValue > 1 ? this.input.stepDown() : "";
    this.qtyInput ? (this.qtyInput.value = this.input.value) : "";
  }
}
customElements.define("quantity-input-new", QuantityInputNew);

class ProductForm extends HTMLElement {
  constructor() {
    super();
    this.form = this.querySelector('form[action="/cart/add"]');
    this.alertField = this.querySelector('[data-role="alert"]');
    this.propertiesInput = this.querySelector(
      '[name="properties[_Personalised]"]'
    );

    this.form.addEventListener("submit", this.addToCart.bind(this));
  }
  getFormData() {
    let data = {};
    const formData = new FormData(this.form);
    for (const pair of formData.entries()) {
      let name = pair[0];
      let value = pair[1];
      if (name.includes("[") && name.includes("]")) {
        const keys = name.split(/[\[\]]/).filter((k) => k);
        const lastKey = keys.pop();
        let obj = data;

        keys.forEach((key) => {
          if (!obj[key]) obj[key] = {};
          obj = obj[key];
        });

        obj[lastKey] = value;
      } else {
        data[name] = value;
      }
    }
    return data;
  }
  async validateProductCount(variantId) {
    const thresholdForItem = 10;
    const thresholdMessage = "Cannot Add More Than 10 Products";
    const { items } = await fetch("/cart.js")
      .then((res) => res.json())
      .then((data) => data);
    const variantInfo = items.find((el) => el.id == variantId);
    if (variantInfo && variantInfo?.quantity >= thresholdForItem) {
      this.displayAlert(thresholdMessage);
      this.classList.remove("loading");
      return false;
    } else {
      return true;
    }
  }

  async addToCart(e) {
    e.preventDefault();
    let formData = { items: [this.getFormData()] };

    let validQuantity = await this.validateProductCount(
      Number(formData.items[0].id)
    );
    if (validQuantity) {
      await fetch(window.Shopify.routes.root + "cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("data", data);
          if (data.status) {
            throw new Error(data.description);
          }

          // open cart drawer
          this.displayAlert("Product added to cart!");
          setTimeout(() => this.hideAlert(), 4000);
        })
        .catch((err) => {
          this.displayAlert(err.message);
          setTimeout(() => this.hideAlert(), 4000);
        });
    }
  }
  displayAlert(message) {
    this.alertField.classList.remove("hidden");
    this.classList.remove("loading");
    this.alertField.innerText = message;
  }
  hideAlert() {
    this.alertField.classList.add("hidden");
  }
}
customElements.define("product-form", ProductForm);

class VariantSelectors extends HTMLElement {
  constructor() {
    super();
    this.selectors = Array.from(
      this.querySelectorAll('[data-role="variant-selector"]')
    );
    this.variantData = JSON.parse(
      this.querySelector('script[data-id="variants-data"]').innerHTML
    );
    this.optionsData = JSON.parse(
      this.querySelector('script[data-id="options-data"]').innerHTML
    );

    document.addEventListener("DOMContentLoaded", () => {
      if (this.optionsData.length > 0) {
        const selectedVariant = this.variantData.find(
          (el) =>
            el.id ==
            this.closest("product-form")?.querySelector('input[name="id"]')
              .value
        );
      }
    });

    !window.sessionStorage[this.dataset.product]
      ? (window.sessionStorage[this.dataset.product] = JSON.stringify({}))
      : "";

    this.addEventListener("change", async (e) => {
      await this.updateProductData.call(this, false, e);
      this.updateSelectedOptionTitle.call(this, e);
    });
    window.addEventListener(
      "popstate",
      this.debounce(async () => {
        let variantId = window.location.search.includes("variant")
          ? window.location.search.split("variant=")[1]
          : false;
        let html = await this.fetchVariantData(variantId);
        this.renderHtml(html);
      }, 300).bind(this)
    );
  }
  updateAvailableOptions(name, value) {
    const inputs = Array.from(
      document
        .querySelector("variant-selectors")
        .querySelectorAll('input[type="radio"]')
    );
    const availableProducts = this.variantData
      .filter((el) => el.available)
      .filter((el) => el.options.indexOf(value) != -1);
    const optionName = name;
    const optionsToCheck = this.optionsData
      .filter((el) => el.name != optionName)
      .map((el) => el.values)
      .flat();
    optionsToCheck.forEach((el) => {
      inputs.find((inp) => inp.value == el).classList.add("unavailable");
    });
    this.optionsData
      .find((el) => el.name == optionName)
      .values.forEach((el) =>
        document
          .querySelector(`variant-selectors input[type="radio"][value="${el}"]`)
          .classList.remove("unavailable")
      );
    if (availableProducts.length > 0) {
      availableProducts.forEach((el) => {
        el.options.forEach((opt) => {
          if (optionsToCheck.indexOf(opt) != -1) {
            document
              .querySelector(
                `variant-selectors input[type="radio"][value="${opt}"]`
              )
              .classList.remove("unavailable");
          }
        });
      });
    }
  }
  updateSelectedOptionTitle(e) {
    const selectorWrapper = e.target.closest('[data-role="selector-wrapper"]');
    const selectedTitle = selectorWrapper.querySelector(
      '[data-role="selectedopt"]'
    );
    selectedTitle ? (selectedTitle.innerText = e.target.value) : "";
  }
  async updateProductData(variantId = false, e) {
    const selectedVariant = variantId
      ? variantId
      : this.getSelectedVariant(this)
      ? this.getSelectedVariant(this).id
      : false;
    if (selectedVariant) {
      this.fireGalleryUpdateEvent.call(this, selectedVariant);
      let html = await this.fetchVariantData(selectedVariant);
      this.updateUrl(selectedVariant);
      this.renderHtml(html);
    } else {
      this.noVariantFoundDataUpdate.call(this);
    }
  }
  noVariantFoundDataUpdate() {
    const unavailableBlock = this.closest("product-form").querySelector(
      '[data-role="unavailable-block"]'
    );
    const availableBlock = this.closest("product-form").querySelector(
      '[data-role="available-block"]'
    );
    unavailableBlock.classList.remove("hidden");
    availableBlock.classList.add("hidden");
    const variantSelectors = Array.from(
      document.querySelectorAll('[data-role="variant-selector"]')
    );
    variantSelectors.forEach((el) => el.classList.add("unavailable"));
    const firtsOptVals = this.optionsData[0].values;
    const selectedopt_1 = variantSelectors.find(
      (el) => el.checked && firtsOptVals.indexOf(el.value) != -1
    ).value;
    const variantsAvailable = this.variantData.filter(
      (el) => el.option1 == selectedopt_1 && el.available
    );
    if (variantsAvailable.length > 0) {
      variantsAvailable.forEach((el) => {
        variantSelectors.forEach((selector) => {
          if (selector.value == el.option2 || selector.value == el.option3) {
            selector.classList.remove("unavailable");
          }
        });
      });
    }
  }
  fireGalleryUpdateEvent(variant) {
    const productMainSlider = document.querySelector(
      "product-gallery [data-role='main-slider']"
    );
    let selectedVariantImage = productMainSlider.querySelector(
      `[data-variant="${variant}"]`
    );

    Array.from(productMainSlider.querySelectorAll("[data-variant]")).forEach(
      (el, ind) => {
        const variants = el.dataset.variant.split(",");
        let selectedVariant = variants.find((el) => el == variant);
        if (selectedVariant) {
          selectedVariantImage = el;
        }
      }
    );

    const updateImageEvent = new CustomEvent("custom:updateGalleryImage", {
      detail: { imageSrc: selectedVariantImage.dataset.src },
    });
    document.dispatchEvent(updateImageEvent);
  }
  getSelectedVariant(e) {
    const selectedValues = this.selectors
      .filter((el) => el.checked)
      .map((el) => el.value);
    const selectedVariant = this.variantData.find(
      (el) =>
        el.options.length == selectedValues.length &&
        el.options.every((val) => selectedValues.indexOf(val) != -1)
    );
    return selectedVariant;
  }
  async memoizeProductData(variantId) {
    let data;
    const sessionVariantData = JSON.parse(
      window.sessionStorage[this.dataset.product]
    );
    if (!sessionVariantData[variantId]) {
      const sectionId = this.dataset.section;
      const url = `${window.location.pathname}?variant=${variantId}&sections=${sectionId}`;
      let htmlData = await fetch(url)
        .then((res) => res.json())
        .catch((err) => console.log(err));
      sessionVariantData[variantId] = htmlData[sectionId];
      window.sessionStorage[this.dataset.product] =
        JSON.stringify(sessionVariantData);
      data = htmlData[sectionId];
    } else {
      data = sessionVariantData[variantId];
    }
    return data;
  }
  async fetchVariantData(variantId) {
    return await this.memoizeProductData(variantId);
  }

  renderHtml(html) {
    const parser = new DOMParser();
    const pdpHtml = parser.parseFromString(html, "text/html");
    const pdpInfo = document.querySelector('[data-role="product-info"]');
    const updatedPdpInfo = pdpHtml.querySelector('[data-role="product-info"]');
    pdpInfo.innerHTML = updatedPdpInfo.innerHTML;
  }
  updateUrl(variantId) {
    const url = `?variant=${variantId}`;
    window.history.pushState("", "", url);
  }
  debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
}
customElements.define("variant-selectors", VariantSelectors);
