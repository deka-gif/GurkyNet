import assert from 'node:assert/strict';

// Lightweight contract checks for Admin CS–ready conversation shape.
type ChatConversationShape = {
  id: string;
  userId: string;
  status: 'open' | 'waiting' | 'assigned' | 'closed';
  assignedAgentId?: string | null;
  unreadCount: number;
};

type ChatMessageShape = {
  id: string;
  conversationId: string;
  senderRole: 'user' | 'agent' | 'system';
  body: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
};

const sampleConv: ChatConversationShape = {
  id: 'conv_1',
  userId: 'user_1',
  status: 'waiting',
  assignedAgentId: null,
  unreadCount: 0,
};

const sampleMsg: ChatMessageShape = {
  id: 'msg_1',
  conversationId: sampleConv.id,
  senderRole: 'user',
  body: 'Halo CS',
  status: 'sent',
};

assert.ok(sampleConv.id);
assert.equal(sampleConv.status, 'waiting');
assert.equal(sampleMsg.senderRole, 'user');
assert.equal(sampleMsg.status, 'sent');

console.log('chatArchitecture tests passed');
