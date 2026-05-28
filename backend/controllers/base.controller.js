const buildFilters = (query = {}) => {
  const excludedKeys = ["page", "limit", "sort", "select"];
  const filters = {};

  for (const [key, value] of Object.entries(query)) {
    if (excludedKeys.includes(key) || value === undefined || value === "") {
      continue;
    }

    filters[key] = value;
  }

  return filters;
};

const applyPopulate = (mongooseQuery, populate = []) => {
  populate.forEach((item) => {
    mongooseQuery.populate(item);
  });
};

export const createCrudControllers = (
  Model,
  { modelName, populate = [], defaultSort = { createdAt: -1 } } = {}
) => {
  const resourceName = modelName || Model.modelName;

  const list = async (req, res) => {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 10000);
      const sort = req.query.sort || defaultSort;
      const filters = buildFilters(req.query);

      const query = Model.find(filters)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);

      applyPopulate(query, populate);

      const [items, total] = await Promise.all([
        query,
        Model.countDocuments(filters)
      ]);

      return res.status(200).json({
        success: true,
        message: `${resourceName} list fetched successfully`,
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  const getById = async (req, res) => {
    try {
      const query = Model.findById(req.params.id);
      applyPopulate(query, populate);

      const item = await query;

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${resourceName} not found`
        });
      }

      return res.status(200).json({
        success: true,
        message: `${resourceName} fetched successfully`,
        data: item
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  const create = async (req, res) => {
    try {
      const item = await Model.create(req.body);
      const createdItemQuery = Model.findById(item._id);
      applyPopulate(createdItemQuery, populate);

      return res.status(201).json({
        success: true,
        message: `${resourceName} created successfully`,
        data: await createdItemQuery
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

  const update = async (req, res) => {
    try {
      const query = Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      });

      applyPopulate(query, populate);
      const item = await query;

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${resourceName} not found`
        });
      }

      return res.status(200).json({
        success: true,
        message: `${resourceName} updated successfully`,
        data: item
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

  const remove = async (req, res) => {
    try {
      const item = await Model.findByIdAndDelete(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${resourceName} not found`
        });
      }

      return res.status(200).json({
        success: true,
        message: `${resourceName} deleted successfully`,
        data: item
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  return {
    list,
    getById,
    create,
    update,
    remove
  };
};
