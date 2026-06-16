import * as inventoryService from "../services/inventory.service.js";

export const getInventoryList = async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      productId: req.query.productId,
      categoryId: req.query.categoryId,
      lowStock: req.query.lowStock,
      outOfStock: req.query.outOfStock,
      sort: req.query.sort
    };

    const pagination = {
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await inventoryService.getInventoryList(filters, pagination);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getVariantInventory = async (req, res) => {
  try {
    const { variantId } = req.params;
    const result = await inventoryService.getVariantInventory(variantId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const importStock = async (req, res) => {
  try {
    const { variantId, quantity, costPrice, note } = req.body;
    const userId = req.user._id;

    const transaction = await inventoryService.importStock(
      variantId,
      quantity,
      costPrice,
      userId,
      note
    );

    res.json({
      message: "Nhập hàng thành công",
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const adjustStock = async (req, res) => {
  try {
    const { variantId, quantity, reason, note } = req.body;
    const userId = req.user._id;

    const transaction = await inventoryService.adjustStock(
      variantId,
      quantity,
      userId,
      reason,
      note
    );

    res.json({
      message: "Điều chỉnh tồn kho thành công",
      data: transaction
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getTransactionHistory = async (req, res) => {
  try {
    const filters = {
      variantId: req.query.variantId,
      productId: req.query.productId,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const pagination = {
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await inventoryService.getTransactionHistory(filters, pagination);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const exportTransactionHistory = async (req, res) => {
  try {
    const filters = {
      variantId: req.query.variantId,
      productId: req.query.productId,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await inventoryService.getTransactionHistory(filters, { page: 1, limit: 10000 });

    const csvRows = [];
    csvRows.push([
      "Thời gian",
      "Sản phẩm",
      "Màu",
      "Size",
      "SKU",
      "Loại giao dịch",
      "Số lượng",
      "Tồn trước",
      "Tồn sau",
      "Lý do",
      "Đơn hàng",
      "Người thực hiện",
      "Ghi chú"
    ].join(","));

    for (const transaction of result.data) {
      const row = [
        new Date(transaction.createdAt).toLocaleString("vi-VN"),
        `"${transaction.productId?.name || ""}"`,
        `"${transaction.variantId?.color || ""}"`,
        `"${transaction.variantId?.size || ""}"`,
        `"${transaction.variantId?.sku || ""}"`,
        transaction.type,
        transaction.quantity,
        transaction.previousStock,
        transaction.newStock,
        `"${transaction.reason || ""}"`,
        transaction.orderId?._id || "",
        `"${transaction.createdBy?.fullname || transaction.createdBy?.username || ""}"`,
        `"${transaction.note || ""}"`
      ];
      csvRows.push(row.join(","));
    }

    const csv = csvRows.join("\n");
    const filename = `inventory-history-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("﻿" + csv);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getLowStockVariants = async (req, res) => {
  try {
    const threshold = req.query.threshold || 5;
    const variants = await inventoryService.getLowStockVariants(threshold);
    res.json({ data: variants });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getInventoryStats = async (req, res) => {
  try {
    const stats = await inventoryService.getInventoryStats();
    res.json(stats);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
