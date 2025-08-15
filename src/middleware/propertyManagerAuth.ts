import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { UserModel } from '../models/UserModel'
import { PropertyModel } from '../models/PropertyModel'

interface PropertyManagerRequest extends Request {
  user?: any
  propertyManager?: {
    id: string
    managedProperties: string[]
  }
}

export const authenticatePropertyManager = async (
  req: PropertyManagerRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    const user = await UserModel.findById(decoded.userId)
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' })
    }

    // Check if user has property manager role
    if (!user.roles?.includes('property_manager')) {
      return res.status(403).json({ error: 'Access denied. Property manager role required.' })
    }

    // Get managed properties for this property manager
    const managedProperties = await PropertyModel.findByManagerId(user.id)
    
    req.user = user
    req.propertyManager = {
      id: user.id,
      managedProperties: managedProperties.map(p => p.id)
    }
    
    next()
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' })
  }
}

export const authorizePropertyAccess = (
  req: PropertyManagerRequest,
  res: Response,
  next: NextFunction
) => {
  const propertyId = req.params.propertyId || req.body.propertyId
  
  if (!propertyId) {
    return res.status(400).json({ error: 'Property ID is required.' })
  }

  if (!req.propertyManager?.managedProperties.includes(propertyId)) {
    return res.status(403).json({ 
      error: 'Access denied. You do not manage this property.' 
    })
  }

  next()
}