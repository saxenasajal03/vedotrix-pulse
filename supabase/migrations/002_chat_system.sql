-- ==============================================================================
-- VEDOTRIX PULSE - ORGANIZATIONAL CHAT SYSTEM (SUPABASE POSTGRESQL)
-- Channels, Direct Messages, and Reactions with Multi-Tenant Isolation
-- ==============================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(50) DEFAULT 'employee',
    sender_avatar TEXT,
    channel VARCHAR(100) DEFAULT 'general',
    recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    reactions JSONB DEFAULT '[]'::jsonb,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for instantaneous queries by channel and organization
CREATE INDEX IF NOT EXISTS idx_chat_org_channel ON chat_messages(org_id, channel);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_recipient ON chat_messages(recipient_id);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policy
CREATE POLICY "Tenant isolation for chat_messages"
ON chat_messages FOR ALL
TO authenticated
USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Enable Realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
