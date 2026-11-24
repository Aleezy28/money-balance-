import type { Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import type { AuthRequest } from '../middleware/authMiddleware.ts';

const VALID_TYPES = new Set(['INCOME', 'EXPENSE']);
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export async function getCategories(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const typeFilter =
      typeof req.query.type === 'string' ? req.query.type.toUpperCase() : undefined;

    const where: { userId: number; type?: string } = { userId };
    if (typeFilter && VALID_TYPES.has(typeFilter)) {
      where.type = typeFilter;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { transactions: true, budgets: true },
        },
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
}

export async function createCategory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { name, type, color, icon } = req.body as {
      name?: string;
      type?: string;
      color?: string;
      icon?: string;
    };

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const normalizedType =
      typeof type === 'string' ? type.trim().toUpperCase() : '';
    const validColor =
      typeof color === 'string' && HEX_COLOR_RE.test(color.trim())
        ? color.trim().toUpperCase()
        : normalizedType === 'INCOME'
          ? '#059669'
          : '#2563EB';
    const validIcon =
      typeof icon === 'string' && icon.trim() ? icon.trim().slice(0, 30) : 'Tag';

    if (!trimmedName || trimmedName.length > 40) {
      res
        .status(400)
        .json({ error: 'Category name must be between 1 and 40 characters.' });
      return;
    }

    if (!VALID_TYPES.has(normalizedType)) {
      res.status(400).json({ error: 'Category type must be INCOME or EXPENSE.' });
      return;
    }

    const existing = await prisma.category.findFirst({
      where: { userId, type: normalizedType, name: trimmedName },
    });

    if (existing) {
      res.status(409).json({
        error: `A ${normalizedType.toLowerCase()} category named "${trimmedName}" already exists.`,
      });
      return;
    }

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        type: normalizedType,
        color: validColor,
        icon: validIcon,
        userId,
      },
      include: {
        _count: { select: { transactions: true, budgets: true } },
      },
    });

    res.status(201).json({ category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category.' });
  }
}

export async function updateCategory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const categoryId = Number(req.params.id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const { name, color, icon } = req.body as {
      name?: string;
      color?: string;
      icon?: string;
    };

    const nextName = name !== undefined ? String(name).trim() : existing.name;
    const nextColor =
      color !== undefined && HEX_COLOR_RE.test(String(color).trim())
        ? String(color).trim().toUpperCase()
        : existing.color;
    const nextIcon =
      icon !== undefined && String(icon).trim()
        ? String(icon).trim().slice(0, 30)
        : existing.icon;

    if (!nextName || nextName.length > 40) {
      res
        .status(400)
        .json({ error: 'Category name must be between 1 and 40 characters.' });
      return;
    }

    const duplicate = await prisma.category.findFirst({
      where: {
        userId,
        type: existing.type,
        name: nextName,
        NOT: { id: categoryId },
      },
    });

    if (duplicate) {
      res.status(409).json({
        error: `Another ${existing.type.toLowerCase()} category named "${nextName}" already exists.`,
      });
      return;
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: nextName,
        color: nextColor,
        icon: nextIcon,
      },
      include: {
        _count: { select: { transactions: true, budgets: true } },
      },
    });

    res.json({ category });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category.' });
  }
}

export async function deleteCategory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const categoryId = Number(req.params.id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    if (category._count.transactions > 0) {
      res.status(400).json({
        error: `Cannot delete "${category.name}" because ${category._count.transactions} transaction(s) use it. Reassign or delete those transactions first.`,
      });
      return;
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    res.json({ message: 'Category deleted.', deletedId: categoryId });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
}
