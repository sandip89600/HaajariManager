import { Request, Response } from "express";
import { Material, MaterialUsage, AuditLog } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

export const getMaterials = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId } = req.params;
    const { search, category } = req.query;

    let query: any = { tenantId, siteId };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (category) {
      query.category = category;
    }

    const list = await Material.find(query).sort({ name: 1 });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addMaterial = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { siteId } = req.params;
    const { 
      name, category, unit, quantityPurchased, minStockLevel, 
      unitPrice, supplierName, purchaseDate, invoiceNumber, 
      storageLocation, notes 
    } = req.body;

    if (!name || !category || !unit || quantityPurchased === undefined || unitPrice === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const totalCost = quantityPurchased * unitPrice;
    const remainingStock = quantityPurchased; // initially purchased = remaining

    const material = new Material({
      tenantId,
      siteId,
      name,
      category,
      unit,
      quantityPurchased,
      quantityUsed: 0,
      remainingStock,
      minStockLevel: minStockLevel || 0,
      unitPrice,
      totalCost,
      supplierName,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      invoiceNumber,
      storageLocation,
      notes
    });

    await material.save();

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "CREATE",
      targetType: "MATERIAL",
      targetId: material._id.toString(),
      changes: { after: material.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.status(201).json(material);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMaterial = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;

    const material = await Material.findOne({ _id: id, tenantId });
    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    const before = material.toObject();

    // Map fields manually to keep logic clean and avoid corrupting stock properties directly
    if (updates.name) material.name = updates.name;
    if (updates.category) material.category = updates.category;
    if (updates.unit) material.unit = updates.unit;
    if (updates.minStockLevel !== undefined) material.minStockLevel = updates.minStockLevel;
    if (updates.supplierName !== undefined) material.supplierName = updates.supplierName;
    if (updates.purchaseDate) material.purchaseDate = new Date(updates.purchaseDate);
    if (updates.invoiceNumber !== undefined) material.invoiceNumber = updates.invoiceNumber;
    if (updates.storageLocation !== undefined) material.storageLocation = updates.storageLocation;
    if (updates.notes !== undefined) material.notes = updates.notes;

    if (updates.quantityPurchased !== undefined || updates.unitPrice !== undefined) {
      const qPurchased = updates.quantityPurchased !== undefined ? updates.quantityPurchased : material.quantityPurchased;
      const uPrice = updates.unitPrice !== undefined ? updates.unitPrice : material.unitPrice;

      material.quantityPurchased = qPurchased;
      material.unitPrice = uPrice;
      material.totalCost = qPurchased * uPrice;
      material.remainingStock = qPurchased - material.quantityUsed;
    }

    await material.save();

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "UPDATE",
      targetType: "MATERIAL",
      targetId: material._id.toString(),
      changes: { before, after: material.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json(material);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMaterial = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;

    const material = await Material.findOne({ _id: id, tenantId });
    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    const before = material.toObject();
    await Material.deleteOne({ _id: id, tenantId });

    // Cascading delete usages
    await MaterialUsage.deleteMany({ materialId: id, tenantId });

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "DELETE",
      targetType: "MATERIAL",
      targetId: id,
      changes: { before }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Material deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const consumeMaterial = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { quantityUsed, notes } = req.body;

    if (quantityUsed === undefined || quantityUsed <= 0) {
      return res.status(400).json({ error: "A valid positive quantity is required" });
    }

    const material = await Material.findOne({ _id: id, tenantId });
    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }

    if (material.remainingStock < quantityUsed) {
      return res.status(400).json({ error: "Insufficient stock available" });
    }

    const before = material.toObject();

    material.quantityUsed += quantityUsed;
    material.remainingStock = material.quantityPurchased - material.quantityUsed;

    await material.save();

    const usage = new MaterialUsage({
      tenantId,
      siteId: material.siteId,
      materialId: id,
      quantityUsed,
      notes,
      updatedBy: userId,
      timestamp: new Date()
    });
    await usage.save();

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "CONSUME",
      targetType: "MATERIAL",
      targetId: id,
      changes: { before, after: material.toObject(), usage: usage.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.status(201).json({ material, usage });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMaterialHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId } = req.params;

    const list = await MaterialUsage.find({ tenantId, siteId })
      .populate("materialId", "name unit category")
      .populate("updatedBy", "name")
      .sort({ timestamp: -1 });

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
