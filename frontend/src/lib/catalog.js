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
    const matchesSearch =
      !filters.search ||
      product.name.toLowerCase().includes(filters.search.toLowerCase());

    const matchesStyle = !filters.style || (
      Array.isArray(product.style)
        ? product.style.includes(filters.style)
        : product.style === filters.style
    );
    const matchesGender = !filters.gender || product.gender === filters.gender;
    const matchesOccasion =
      !filters.occasion || (product.occasion || []).includes(filters.occasion);
    const matchesSoldOnly = !filters.soldOnly || Number(product.soldCount || 0) > 0;

    return matchesSearch && matchesStyle && matchesGender && matchesOccasion && matchesSoldOnly;
  });
}
