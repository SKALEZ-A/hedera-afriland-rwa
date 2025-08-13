-- Add missing fields to property_documents table for enhanced document management

-- Add IPFS hash field for better tracking
ALTER TABLE property_documents 
ADD COLUMN IF NOT EXISTS ipfs_hash VARCHAR(100);

-- Add verification notes field
ALTER TABLE property_documents 
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Add updated_at timestamp
ALTER TABLE property_documents 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_property_documents_updated_at 
BEFORE UPDATE ON property_documents 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add index for document type filtering
CREATE INDEX IF NOT EXISTS idx_property_documents_type ON property_documents(document_type);

-- Add index for verification status filtering
CREATE INDEX IF NOT EXISTS idx_property_documents_verification ON property_documents(verification_status);

-- Add index for property_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_property_documents_property_id ON property_documents(property_id);