export function attachVariantsToProducts(products, variants) {
  return products.map((product) => ({
    ...product,
    availableVariants: variants.filter(
      (variant) =>
        String(variant.productId?._id ?? variant.productId) === String(product._id)
    )
  }));
}

export function buildCatalogFilters(productsWithVariants) {
  const styles = [
    ...new Set(
      productsWithVariants.flatMap((item) => {
        if (!item.style) return [];
        return Array.isArray(item.style) ? item.style : [item.style];
      }).filter(Boolean)
    )
  ];
  const genders = [...new Set(productsWithVariants.map((item) => item.gender).filter(Boolean))];
  const occasions = [
    ...new Set(productsWithVariants.flatMap((item) => item.occasion || []).filter(Boolean))
  ];

  return {
    styles,
    genders,
    occasions
  };
}

export function filterProducts(products, filters) {
  return products.filter((product) => {
    const matchesStyle = !filters.style || (
      Array.isArray(product.style)
        ? product.style.includes(filters.style)
        : product.style === filters.style
    );
    const matchesGender = !filters.gender || product.gender === filters.gender;
    const matchesOccasion =
      !filters.occasion || (product.occasion || []).includes(filters.occasion);
    const matchesSoldOnly = !filters.soldOnly || Number(product.soldCount || 0) > 0;
    const matchesDiscountOnly =
      !filters.discountOnly ||
      Number(product.discount || 0) > 0 ||
      (product.availableVariants || []).some(
        (variant) => Number(variant.discount || 0) > 0,
      );

    // Lọc theo khoảng giá hiển thị (giá đã giảm)
    let matchesPrice = true;
    if (filters.minPrice || filters.maxPrice) {
      const basePrice = Number(product.price || 0);
      const variants = product.availableVariants || [];
      const firstVariant = variants[0] || null;
      const priceAdjustment = Number(firstVariant?.priceAdjustment || 0);
      const priceBeforeDiscount = basePrice + priceAdjustment;
      const productDiscount = product.discount || 0;
      const variantDiscount = firstVariant?.discount;
      const effectiveDiscount =
        variantDiscount !== null && variantDiscount !== undefined
          ? variantDiscount
          : productDiscount;
      const displayPrice =
        effectiveDiscount > 0
          ? Math.round(priceBeforeDiscount * (1 - effectiveDiscount / 100))
          : priceBeforeDiscount;

      if (filters.minPrice && displayPrice < Number(filters.minPrice)) {
        matchesPrice = false;
      }
      if (filters.maxPrice && displayPrice > Number(filters.maxPrice)) {
        matchesPrice = false;
      }
    }

    return (
      matchesStyle &&
      matchesGender &&
      matchesOccasion &&
      matchesSoldOnly &&
      matchesDiscountOnly &&
      matchesPrice
    );
  });
}
