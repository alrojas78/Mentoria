// MentorPage.js — Mentor 2.0: LMS Híbrido con video embebido + chat IA
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled, { keyframes, css } from 'styled-components';
import { mentor2Service, realtimeSessionService } from '../services/api';
import { RealtimeSession, SESSION_STATES, isRealtimeSupported } from '../services/realtimeService';
import { useAuth } from '../contexts/AuthContext';

// ─── Animaciones ───
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const slideIn = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
`;

// ─── Layout Principal ───
const PageWrapper = styled.div`
  /* ─── Theme tokens (dark default) ─── */
  --m-bg-page: #0c1220;
  --m-bg-sidebar: #111827;
  --m-bg-card: rgba(255,255,255,0.05);
  --m-bg-input: rgba(255,255,255,0.06);
  --m-bg-input-focus: rgba(255,255,255,0.08);
  --m-bg-hover: rgba(255,255,255,0.03);
  --m-bg-hover-strong: rgba(255,255,255,0.1);
  --m-bg-active: rgba(8,145,178,0.12);
  --m-text-primary: #fff;
  --m-text-secondary: rgba(255,255,255,0.7);
  --m-text-tertiary: rgba(255,255,255,0.5);
  --m-text-muted: rgba(255,255,255,0.4);
  --m-text-faint: rgba(255,255,255,0.35);
  --m-text-disabled: rgba(255,255,255,0.2);
  --m-border: rgba(255,255,255,0.06);
  --m-border-medium: rgba(255,255,255,0.08);
  --m-border-light: rgba(255,255,255,0.1);
  --m-chat-user-bg: rgba(8,145,178,0.15);
  --m-chat-user-text: #e0f2fe;
  --m-chat-ai-bg: rgba(255,255,255,0.05);
  --m-chat-ai-text: rgba(255,255,255,0.8);
  --m-chat-ai-border: transparent;
  --m-success: #34D399;
  --m-scrollbar-thumb: rgba(255,255,255,0.08);

  ${p => p.$light && css`
    --m-bg-page: #f1f5f9;
    --m-bg-sidebar: #ffffff;
    --m-bg-card: rgba(0,0,0,0.03);
    --m-bg-input: rgba(0,0,0,0.04);
    --m-bg-input-focus: rgba(0,0,0,0.06);
    --m-bg-hover: rgba(0,0,0,0.04);
    --m-bg-hover-strong: rgba(0,0,0,0.07);
    --m-bg-active: rgba(8,145,178,0.08);
    --m-text-primary: #1e293b;
    --m-text-secondary: #475569;
    --m-text-tertiary: #64748b;
    --m-text-muted: #94a3b8;
    --m-text-faint: #94a3b8;
    --m-text-disabled: #94a3b8;
    --m-border: rgba(0,0,0,0.08);
    --m-border-medium: rgba(0,0,0,0.1);
    --m-border-light: rgba(0,0,0,0.12);
    --m-chat-user-bg: rgba(8,145,178,0.1);
    --m-chat-user-text: #0c4a6e;
    --m-chat-ai-bg: #ffffff;
    --m-chat-ai-text: #334155;
    --m-chat-ai-border: rgba(0,0,0,0.08);
    --m-success: #10b981;
    --m-scrollbar-thumb: rgba(0,0,0,0.1);
  `}

  height: 100vh;
  background: var(--m-bg-page);
  display: grid;
  grid-template-columns: ${p => {
    const sidebar = p.$collapsed ? '40px' : '280px';
    return p.$right ? `1fr ${sidebar}` : `${sidebar} 1fr`;
  }};
  overflow: hidden;
  transition: background 0.3s ease, grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const Sidebar = styled.aside`
  background: var(--m-bg-sidebar);
  ${p => p.$right
    ? 'border-left: 1px solid var(--m-border); border-right: none;'
    : 'border-right: 1px solid var(--m-border); border-left: none;'}
  overflow: ${p => p.$collapsed ? 'hidden' : 'visible'};
  overflow-y: ${p => p.$collapsed ? 'hidden' : 'auto'};
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  min-width: 0;
  order: ${p => p.$right ? 1 : 0};
  transition: background 0.3s ease, border-color 0.3s ease;

  @media (max-width: 768px) {
    position: fixed;
    top: 0;
    left: 0;
    width: 300px;
    z-index: 1000;
    order: 0;
    border-right: 1px solid var(--m-border);
    border-left: none;
    overflow-y: auto;
    transform: ${p => p.$open ? 'translateX(0)' : 'translateX(-100%)'};
    transition: transform 0.3s ease, background 0.3s ease;
    box-shadow: ${p => p.$open ? '4px 0 24px rgba(0,0,0,0.5)' : 'none'};
  }
`;

const SidebarOverlay = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: ${p => p.$open ? 'block' : 'none'};
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;
  }
`;

const MainArea = styled.main`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  order: ${p => p.$right ? 0 : 1};

  @media (max-width: 768px) {
    order: 0;
  }
`;

// ─── Sidebar Internals ───
const SidebarHeader = styled.div`
  padding: 1.25rem;
  border-bottom: 1px solid var(--m-border);
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: var(--m-text-tertiary);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 4px;
  &:hover { color: var(--m-text-primary); }
`;

const ProgramTitle = styled.h2`
  font-size: 1rem;
  font-weight: 700;
  color: var(--m-text-primary);
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
`;

const ProgressBar = styled.div`
  height: 4px;
  background: var(--m-border-medium);
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #0891B2, #06b6d4);
  border-radius: 2px;
  width: ${p => p.$percent}%;
  transition: width 0.5s ease;
`;

const ProgressText = styled.span`
  font-size: 0.7rem;
  color: var(--m-text-muted);
  margin-top: 4px;
  display: block;
`;

const ModuleList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
`;

const SidebarContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  opacity: ${p => p.$collapsed ? 0 : 1};
  visibility: ${p => p.$collapsed ? 'hidden' : 'visible'};
  transition: opacity 0.2s ease, visibility 0.2s ease;

  @media (max-width: 768px) {
    opacity: 1;
    visibility: visible;
  }
`;

const SidebarHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
`;

const SidebarAction = styled.button`
  background: var(--m-bg-input);
  border: 1px solid var(--m-border-medium);
  color: var(--m-text-tertiary);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  &:hover {
    color: var(--m-text-primary);
    background: var(--m-bg-hover-strong);
    border-color: var(--m-border-light);
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const CollapseTab = styled.button`
  background: none;
  border: none;
  border-top: 1px solid var(--m-border);
  color: var(--m-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  flex-shrink: 0;
  transition: color 0.2s, background 0.2s;
  &:hover {
    color: var(--m-text-primary);
    background: var(--m-bg-hover);
  }

  svg {
    transition: transform 0.3s ease;
    transform: rotate(${p => {
      // Base SVG points left (←)
      // No collapsed + left = ← (collapse) = 0deg
      // Collapsed + left = → (expand) = 180deg
      // No collapsed + right = → (collapse) = 180deg
      // Collapsed + right = ← (expand) = 0deg
      const shouldRotate = p.$collapsed !== p.$right;
      return shouldRotate ? '180deg' : '0deg';
    }});
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const ModuleGroup = styled.div`
  margin-bottom: 0.25rem;
`;

const ModuleHeader = styled.button`
  width: 100%;
  background: none;
  border: none;
  padding: 0.6rem 1.25rem;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${p => p.$status === 'completed' ? 'var(--m-success)' : p.$status === 'current' ? '#06b6d4' : 'var(--m-text-muted)'};
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  &:hover { background: var(--m-bg-hover); }
`;

const LessonList = styled.div`
  ${p => !p.$expanded && 'display: none;'}
`;

const LessonItem = styled.button`
  width: 100%;
  background: ${p => p.$active ? 'var(--m-bg-active)' : 'none'};
  border: none;
  border-left: 3px solid ${p =>
    p.$completed ? 'var(--m-success)' :
    p.$active ? '#0891B2' :
    'transparent'};
  padding: 0.55rem 1.25rem 0.55rem 1.5rem;
  text-align: left;
  cursor: ${p => p.$locked ? 'not-allowed' : 'pointer'};
  opacity: ${p => p.$locked ? 0.35 : 1};
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${p => p.$active ? 'var(--m-text-primary)' : 'var(--m-text-secondary)'};
  font-size: 0.82rem;
  transition: all 0.15s ease;

  &:hover {
    ${p => !p.$locked && css`background: var(--m-bg-hover);`}
  }
`;

const StatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${p =>
    p.$completed ? 'var(--m-success)' :
    p.$active ? '#0891B2' :
    'var(--m-text-disabled)'};
  ${p => p.$active && css`box-shadow: 0 0 8px rgba(8,145,178,0.5);`}
`;

// ─── Video Player ───
const VideoSection = styled.div`
  padding: 0.5rem 1rem 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    padding: 0;
  }
`;

const VideoHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0.4rem;
  padding: 0;

  @media (max-width: 768px) {
    padding: 0.5rem 0.75rem;
  }
`;

const HamburgerBtn = styled.button`
  display: none;
  background: var(--m-bg-input);
  border: 1px solid var(--m-border-light);
  color: var(--m-text-primary);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;

  @media (max-width: 768px) {
    display: flex;
  }
`;

const VideoTitle = styled.h1`
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--m-text-primary);
  margin: 0;
  line-height: 1.2;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VideoContainer = styled.div`
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 200px;
  background: #000;
  border-radius: 10px;
  overflow: hidden;

  @media (max-width: 768px) {
    border-radius: 0;
    min-height: 180px;
  }

  iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
`;

const VideoOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  cursor: pointer;
`;

const PlayButton = styled.button`
  background: rgba(8,145,178,0.9);
  border: none;
  color: #fff;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  box-shadow: 0 4px 24px rgba(8,145,178,0.4);
  transition: transform 0.2s;
  &:hover { transform: scale(1.1); }
`;

const SeekWarning = styled.div`
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239,68,68,0.9);
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  z-index: 10;
`;

const VideoLoader = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.5);
  font-size: 0.9rem;
  animation: ${pulse} 1.5s infinite;
`;

// ─── Custom Video Controls (Modern Glassmorphism) ───
const ControlsOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  z-index: 4;
  pointer-events: none;
`;

const ControlsClickArea = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  cursor: pointer;
  pointer-events: auto;
`;

const BigPlayBtn = styled.button`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(8,145,178,0.7);
  backdrop-filter: blur(12px);
  border: 2px solid rgba(255,255,255,0.2);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
  pointer-events: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
    background: rgba(8,145,178,0.85);
    box-shadow: 0 8px 40px rgba(8,145,178,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
  }

  svg { margin-left: 3px; }
`;

const ControlBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 12px 10px;
  padding: 6px 14px;
  background: rgba(10,15,25,0.65);
  backdrop-filter: blur(16px);
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.06);
  pointer-events: auto;
  opacity: ${p => p.$visible ? 1 : 0};
  transform: ${p => p.$visible ? 'translateY(0)' : 'translateY(6px)'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
`;

const CtrlBtn = styled.button`
  background: none;
  border: none;
  color: rgba(255,255,255,0.75);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: all 0.15s;
  &:hover {
    color: #fff;
    background: rgba(255,255,255,0.08);
  }
`;

const ProgressBarWrapper = styled.div`
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  transition: height 0.15s;

  &:hover { height: 5px; }
`;

const ProgressBarFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #22d3ee);
  border-radius: 3px;
  width: ${p => p.$percent}%;
  transition: width 0.15s linear;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: -5px;
    top: 50%;
    transform: translateY(-50%) scale(0);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #22d3ee;
    box-shadow: 0 0 8px rgba(34,211,238,0.5);
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  ${ProgressBarWrapper}:hover &::after {
    transform: translateY(-50%) scale(1);
  }
`;

const MaxReachedBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  width: ${p => p.$percent}%;
`;

const TimeLabel = styled.span`
  font-size: 0.68rem;
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.3px;
`;

// ─── Navigation ───
const NavBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 1rem;
  gap: 12px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 0.4rem 0.75rem;
  }
`;

const NavBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0.35rem 0.9rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
  border: none;
  transition: all 0.2s;

  ${p => p.$primary ? css`
    background: ${p.disabled ? 'rgba(8,145,178,0.2)' : 'linear-gradient(135deg, #0891B2, #0e7490)'};
    color: ${p.disabled ? 'var(--m-text-disabled)' : '#fff'};
    &:hover:not(:disabled) {
      box-shadow: 0 4px 16px rgba(8,145,178,0.35);
    }
  ` : css`
    background: var(--m-bg-input);
    color: ${p.disabled ? 'var(--m-text-disabled)' : 'var(--m-text-secondary)'};
    border: 1px solid var(--m-border-medium);
    &:hover:not(:disabled) { background: var(--m-bg-hover-strong); }
  `}
`;

const NavStatus = styled.span`
  font-size: 0.7rem;
  color: var(--m-text-faint);
`;

// ─── Chat (collapsible) ───
const ChatSection = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 1rem 0.4rem;
  flex-shrink: 0;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: ${p => p.$expanded ? '30vh' : '44px'};
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 0 0.75rem 0.4rem;
    max-height: ${p => p.$expanded ? '35vh' : '44px'};
  }
`;

const ChatToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-height: 36px;
`;

const ChatBadge = styled.span`
  font-size: 0.65rem;
  padding: 1px 7px;
  border-radius: 8px;
  font-weight: 600;
  flex-shrink: 0;
  background: ${p => p.$quiz ? 'rgba(245,158,11,0.15)' : 'rgba(8,145,178,0.15)'};
  color: ${p => p.$quiz ? '#F59E0B' : '#06b6d4'};
`;

const ChatCollapseBtn = styled.button`
  background: none;
  border: none;
  color: var(--m-text-faint);
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  border-radius: 6px;
  transition: all 0.15s;
  flex-shrink: 0;
  &:hover { color: var(--m-text-secondary); background: var(--m-bg-hover); }

  svg {
    transition: transform 0.3s;
    transform: ${p => p.$expanded ? 'rotate(180deg)' : 'rotate(0)'};
  }
`;

const ChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0.25rem 0;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: var(--m-scrollbar-thumb); border-radius: 2px; }
`;

const ChatBubble = styled.div`
  max-width: 88%;
  padding: 0.4rem 0.7rem;
  border-radius: 10px;
  font-size: 0.78rem;
  line-height: 1.4;
  margin-bottom: 0.3rem;
  white-space: pre-wrap;

  ${p => p.$role === 'user' ? css`
    background: var(--m-chat-user-bg);
    color: var(--m-chat-user-text);
    margin-left: auto;
    border-bottom-right-radius: 3px;
  ` : css`
    background: var(--m-chat-ai-bg);
    color: var(--m-chat-ai-text);
    border: 1px solid var(--m-chat-ai-border);
    border-bottom-left-radius: 3px;
  `}
`;

const ChatInputRow = styled.form`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  flex: 1;
`;

const ChatInput = styled.input`
  flex: 1;
  background: var(--m-bg-input);
  border: 1px solid var(--m-border-medium);
  border-radius: 20px;
  padding: 0.4rem 0.9rem;
  color: var(--m-text-primary);
  font-size: 0.8rem;
  outline: none;
  transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease;
  &:focus { border-color: rgba(8,145,178,0.4); background: var(--m-bg-input-focus); }
  &::placeholder { color: var(--m-text-disabled); }
`;

const SendBtn = styled.button`
  background: linear-gradient(135deg, #0891B2, #0e7490);
  border: none;
  color: #fff;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  &:hover:not(:disabled) { box-shadow: 0 2px 12px rgba(8,145,178,0.3); transform: scale(1.05); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const MicBtn = styled.button`
  background: ${p => p.$recording
    ? p.$state === 'listening' ? 'rgba(239,68,68,0.9)'
    : p.$state === 'ai_speaking' ? 'rgba(8,145,178,0.9)'
    : p.$state === 'connecting' ? 'rgba(107,114,128,0.7)'
    : 'rgba(16,185,129,0.9)'
    : 'var(--m-bg-input)'};
  border: 1px solid ${p => p.$recording
    ? p.$state === 'listening' ? 'rgba(239,68,68,0.4)'
    : 'rgba(8,145,178,0.4)'
    : 'var(--m-border-medium)'};
  color: ${p => p.$recording ? '#fff' : 'var(--m-text-secondary)'};
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  ${p => p.$recording && p.$state === 'listening' && css`animation: ${pulse} 1s infinite;`}
  ${p => p.$recording && p.$state === 'connecting' && css`animation: ${pulse} 0.8s infinite;`}
  &:hover:not(:disabled) {
    transform: scale(1.05);
  }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

const VoiceToggle = styled.button`
  background: ${p => p.$active ? 'rgba(8,145,178,0.15)' : 'none'};
  border: none;
  color: ${p => p.$active ? '#06b6d4' : 'var(--m-text-muted)'};
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 6px;
  transition: all 0.15s;
  flex-shrink: 0;
  &:hover { color: ${p => p.$active ? '#22d3ee' : 'var(--m-text-secondary)'}; }
`;

// ─── Estados de carga / error ───
const LoadingScreen = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--m-bg-page);
  color: var(--m-text-tertiary);
  font-size: 1rem;
  animation: ${pulse} 1.5s infinite;
`;

const ErrorScreen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--m-bg-page);
  color: var(--m-text-secondary);
  gap: 1rem;
  padding: 2rem;
  text-align: center;
`;

const CompletedBanner = styled.div`
  background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(8,145,178,0.08));
  border: 1px solid rgba(16,185,129,0.2);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin: 0.5rem 1rem 0;
  text-align: center;
  flex-shrink: 0;

  h2 { color: var(--m-success); margin: 0 0 0.25rem; font-size: 1rem; }
  p { color: var(--m-text-secondary); margin: 0; font-size: 0.8rem; }
`;

// ─── Theme Toggle ───
const ThemeToggle = styled.button`
  width: 44px;
  height: 22px;
  border-radius: 11px;
  border: 1px solid var(--m-border-light);
  background: var(--m-bg-input);
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${p => p.$light ? '23px' : '2px'};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${p => p.$light
      ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
      : 'linear-gradient(135deg, #6366f1, #818cf8)'};
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
`;

const ThemeIcon = styled.span`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  line-height: 1;
  transition: opacity 0.2s;
  user-select: none;
  color: var(--m-text-secondary);
  ${p => p.$side === 'left' ? 'left: 5px;' : 'right: 5px;'}
  opacity: ${p => p.$visible ? 1 : 0};
`;

// ══════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════

const MentorPage = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Tema
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('mentor-theme') === 'light');
  const toggleTheme = () => {
    setLightMode(prev => {
      const next = !prev;
      localStorage.setItem('mentor-theme', next ? 'light' : 'dark');
      return next;
    });
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('mentor-sidebar-collapsed', String(next));
      return next;
    });
  };

  const toggleSidebarPosition = () => {
    setSidebarRight(prev => {
      const next = !prev;
      localStorage.setItem('mentor-sidebar-position', next ? 'right' : 'left');
      return next;
    });
  };

  // Estado principal
  const [mentorData, setMentorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('mentor-sidebar-collapsed') === 'true'
  );
  const [sidebarRight, setSidebarRight] = useState(
    () => localStorage.getItem('mentor-sidebar-position') === 'right'
  );

  // Video player
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [videoStatus, setVideoStatus] = useState('loading'); // loading | playing | paused | completed
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showStartOverlay, setShowStartOverlay] = useState(false);
  const [showSeekWarning, setShowSeekWarning] = useState(false);
  const [playerKey, setPlayerKey] = useState(0); // State key to force iframe remount
  const playerRef = useRef(null);
  const maxTimeReached = useRef(0);
  const lastSavedTime = useRef(0);
  const IFRAME_ID = 'mentor-vimeo-player';

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatEndRef = useRef(null);

  // Quiz
  const [quizActive, setQuizActive] = useState(false);
  const [quizPregunta, setQuizPregunta] = useState(0);
  const [quizCompleto, setQuizCompleto] = useState(false);

  // Realtime Voice
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [realtimeState, setRealtimeState] = useState(SESSION_STATES.DISCONNECTED);
  const [realtimePartial, setRealtimePartial] = useState('');
  const [realtimeAudioLevel, setRealtimeAudioLevel] = useState(0);
  const [realtimeError, setRealtimeError] = useState('');
  const realtimeSessionRef = useRef(null);
  const realtimeAiBuffer = useRef('');
  const realtimeTranscriptsRef = useRef([]);

  // Derivar video actual y allowSeek
  const videoActual = mentorData?.video_actual;
  const isReplay = useRef(false);

  // ─── LOAD DATA ───
  const loadMentorData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await mentor2Service.start(documentId);
      const data = res.data?.data || res.data;
      setMentorData(data);

      // Expandir módulo actual
      if (data.modulo_actual) {
        setExpandedModules(prev => ({ ...prev, [data.modulo_actual]: true }));
      }
    } catch (err) {
      console.error('Error cargando mentor:', err);
      setError(err.response?.data?.message || 'Error al cargar el programa');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadMentorData();
    return () => destroyPlayer();
  }, [loadMentorData]);

  // ─── VIMEO PLAYER ───
  // No llamar player.destroy() aquí — Vimeo SDK remueve el iframe del DOM
  // y React crashea al no encontrar el nodo durante reconciliación.
  // El iframe se limpia via cambio de playerKey (React unmount/mount).
  const destroyPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.off('play');
        playerRef.current.off('pause');
        playerRef.current.off('timeupdate');
        playerRef.current.off('ended');
        playerRef.current.off('seeked');
      } catch (e) { /* ignore */ }
      playerRef.current = null;
    }
    setIsPlayerReady(false);
    setVideoStatus('loading');
    setShowStartOverlay(false);
    maxTimeReached.current = 0;
    lastSavedTime.current = 0;
  }, []);

  // ─── VIMEO PLAYER INIT ───
  // Effect 1: When video changes, reset state and bump playerKey to remount iframe
  useEffect(() => {
    if (!videoActual?.vimeo_id) return;

    // Detach old player (no destroy — React handles DOM via key change)
    if (playerRef.current) {
      try { playerRef.current.pause(); } catch (e) { /* ignore */ }
      playerRef.current = null;
    }
    setIsPlayerReady(false);
    setVideoStatus('loading');
    setShowStartOverlay(false);
    setShowSeekWarning(false);
    maxTimeReached.current = 0;
    lastSavedTime.current = 0;

    setQuizActive(false);
    setQuizCompleto(false);
    isReplay.current = false;

    // Bump key → React remounts iframe with new src
    setPlayerKey(k => k + 1);
  }, [videoActual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2: After iframe remounts (playerKey changes), init the Vimeo player
  useEffect(() => {
    if (!videoActual?.vimeo_id || playerKey === 0) return;

    const initPlayer = () => {
      const iframe = document.getElementById(IFRAME_ID);
      if (!iframe || playerRef.current) return;

      playerRef.current = new window.Vimeo.Player(iframe);

      playerRef.current.ready().then(() => {
        setIsPlayerReady(true);

        playerRef.current.getDuration().then(d => setVideoDuration(d)).catch(() => {});

        // Resume from saved timestamp
        const resumeFrom = videoActual?.timestamp_actual || 0;
        if (resumeFrom > 0) {
          playerRef.current.setCurrentTime(resumeFrom).catch(() => {});
        }
        maxTimeReached.current = videoActual?.timestamp_maximo || resumeFrom || 0;

        // Try autoplay
        playerRef.current.play().then(() => {
          return Promise.all([
            playerRef.current.getMuted(),
            playerRef.current.getVolume()
          ]);
        }).then(([isMuted, volume]) => {
          if (isMuted || volume < 0.1) {
            // iOS muted autoplay — pause and show overlay
            playerRef.current.pause();
            setVideoStatus('paused');
            setShowStartOverlay(true);
          } else {
            setVideoStatus('playing');
          }
        }).catch(() => {
          // Autoplay blocked — user needs to click play (Vimeo controls=1 handles this)
          setVideoStatus('paused');
        });
      });

      // Events
      playerRef.current.on('play', () => {
        setVideoStatus('playing');
        setShowStartOverlay(false);
      });

      playerRef.current.on('pause', (d) => {
        setVideoStatus('paused');
        if (!isReplay.current) saveProgress(d.seconds);
      });

      playerRef.current.on('timeupdate', (d) => {
        setCurrentTime(d.seconds);
        if (d.seconds > maxTimeReached.current) maxTimeReached.current = d.seconds;
        if (!isReplay.current && Math.abs(d.seconds - lastSavedTime.current) >= 10) {
          lastSavedTime.current = d.seconds;
          saveProgress(d.seconds);
        }
      });

      playerRef.current.on('ended', () => {
        setVideoStatus('completed');
        if (!isReplay.current) {
          saveProgress(videoDuration || 9999, true);
          handleVideoComplete();
        }
      });

      // Seek blocking (unless replay)
      playerRef.current.on('seeked', (d) => {
        if (!isReplay.current && d.seconds > maxTimeReached.current + 2) {
          playerRef.current.setCurrentTime(maxTimeReached.current).catch(() => {});
          setShowSeekWarning(true);
          setTimeout(() => setShowSeekWarning(false), 3000);
        }
      });
    };

    // Load Vimeo SDK if needed, then init
    const t = setTimeout(() => {
      if (window.Vimeo) {
        initPlayer();
      } else {
        const script = document.createElement('script');
        script.src = 'https://player.vimeo.com/api/player.js';
        script.onload = initPlayer;
        document.head.appendChild(script);
      }
    }, 150);

    return () => clearTimeout(t);
  }, [playerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualStart = () => {
    if (!playerRef.current) return;
    playerRef.current.setMuted(false);
    playerRef.current.setVolume(1);
    playerRef.current.play().then(() => {
      setShowStartOverlay(false);
      setVideoStatus('playing');
    }).catch(e => console.error('Error al iniciar:', e));
  };

  // ─── CUSTOM CONTROLS ───
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (videoStatus === 'playing') {
      playerRef.current.pause();
    } else {
      playerRef.current.play().catch(() => {});
    }
  };

  const handleRewind10 = () => {
    if (!playerRef.current) return;
    const newTime = Math.max(0, currentTime - 10);
    playerRef.current.setCurrentTime(newTime).catch(() => {});
  };

  const handleForward10 = () => {
    if (!playerRef.current || isReplay.current) return;
    // Only allow forward up to maxTimeReached
    const newTime = Math.min(maxTimeReached.current, currentTime + 10);
    playerRef.current.setCurrentTime(newTime).catch(() => {});
  };

  const handleProgressClick = (e) => {
    if (!playerRef.current || !videoDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const targetTime = pct * videoDuration;

    // If not replay, only allow seeking up to maxTimeReached
    if (!isReplay.current && targetTime > maxTimeReached.current + 2) {
      setShowSeekWarning(true);
      setTimeout(() => setShowSeekWarning(false), 2000);
      return;
    }
    playerRef.current.setCurrentTime(targetTime).catch(() => {});
  };

  const handleVideoAreaClick = () => {
    togglePlayPause();
    // Show controls briefly
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (videoStatus === 'playing') setShowControls(false);
    }, 3000);
  };

  const handleMouseMoveOnVideo = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (videoStatus === 'playing') setShowControls(false);
    }, 3000);
  };

  const progressPercent = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
  const maxReachedPercent = videoDuration > 0 ? (maxTimeReached.current / videoDuration) * 100 : 0;

  // ─── SAVE PROGRESS ───
  const saveProgress = async (timeInSeconds, forceCompleted = false) => {
    if (!videoActual?.id) return;
    const percentage = videoDuration > 0 ? (timeInSeconds / videoDuration) * 100 : 0;
    const isCompleted = forceCompleted || percentage >= 90;

    try {
      await mentor2Service.saveVideoProgress({
        video_id: videoActual.id,
        document_id: parseInt(documentId),
        timestamp_actual: Math.round(timeInSeconds),
        timestamp_maximo: Math.max(Math.round(timeInSeconds), Math.round(maxTimeReached.current)),
        completado: isCompleted ? 1 : 0
      });
    } catch (e) {
      console.error('Error guardando progreso:', e);
    }
  };

  // ─── VIDEO COMPLETE → QUIZ ───
  const handleVideoComplete = () => {
    if (!videoActual?.id) return;
    if (realtimeActive) disconnectRealtime();
    setChatExpanded(true);
    setChatMessages(prev => [...prev, {
      role: 'ai',
      text: 'Has completado la lección. Generando preguntas de repaso...'
    }]);
    generateQuiz();
  };

  const generateQuiz = async () => {
    try {
      setChatLoading(true);
      setQuizActive(true);
      setQuizPregunta(1);

      const res = await mentor2Service.generateQuiz(documentId, videoActual.id);
      const data = res.data?.data || res.data;

      setChatMessages(prev => [...prev, { role: 'ai', text: data.mensaje }]);
    } catch (e) {
      console.error('Error generando quiz:', e);
      setChatMessages(prev => [...prev, {
        role: 'ai',
        text: 'No se pudieron generar las preguntas. Puedes avanzar a la siguiente lección.'
      }]);
      setQuizCompleto(true);
      setQuizActive(false);
    } finally {
      setChatLoading(false);
    }
  };

  // ─── REALTIME VOICE ───
  const connectRealtime = useCallback(async () => {
    if (realtimeSessionRef.current) return;
    setRealtimeError('');
    setRealtimePartial('');
    realtimeAiBuffer.current = '';
    realtimeTranscriptsRef.current = [];

    // Pausar video para que el mic no capte el audio
    if (playerRef.current && videoStatus === 'playing') {
      playerRef.current.pause().catch(() => {});
    }

    // Expandir chat una sola vez al conectar (el usuario puede colapsar después)
    setChatExpanded(true);

    const session = new RealtimeSession({
      documentId: parseInt(documentId),
      mode: 'mentor',
      videoId: videoActual?.id,
      videoTitle: videoActual?.titulo_completo,
      lessonContext: mentorData ? `Módulo ${mentorData.modulo_actual} - Lección ${mentorData.leccion_actual}` : null,
      currentTime: Math.round(currentTime),
      onStateChange: (state) => setRealtimeState(state),
      onTranscript: (text) => {
        setChatMessages(prev => [...prev, { role: 'user', text }]);
        realtimeTranscriptsRef.current.push(text);
      },
      onAITranscript: (text, isDone) => {
        if (isDone) {
          setChatMessages(prev => [...prev, { role: 'ai', text }]);
          setRealtimePartial('');
          realtimeAiBuffer.current = '';
        } else {
          realtimeAiBuffer.current += text;
          setRealtimePartial(realtimeAiBuffer.current);
        }
      },
      onError: (msg) => {
        setRealtimeError(msg);
        if (msg === 'REALTIME_NOT_AVAILABLE') {
          setRealtimeActive(false);
        }
      },
      onAudioLevel: (level) => setRealtimeAudioLevel(level)
    });

    realtimeSessionRef.current = session;
    setRealtimeActive(true);
    await session.connect();
  }, [documentId, videoActual?.id, videoActual?.titulo_completo, mentorData?.modulo_actual, mentorData?.leccion_actual, currentTime, videoStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRealtimeTranscripts = useCallback(async () => {
    const transcripts = realtimeTranscriptsRef.current;
    if (!transcripts || transcripts.length === 0) return;
    try {
      await realtimeSessionService.saveTranscripts(
        documentId,
        transcripts.map(text => ({ text })),
        0,
        'mentor'
      );
    } catch (e) {
      console.error('Error guardando transcripciones:', e);
    }
  }, [documentId]);

  const disconnectRealtime = useCallback(() => {
    saveRealtimeTranscripts();
    if (realtimeSessionRef.current) {
      realtimeSessionRef.current.disconnect();
      realtimeSessionRef.current = null;
    }
    setRealtimeActive(false);
    setRealtimeState(SESSION_STATES.DISCONNECTED);
    setRealtimePartial('');
    realtimeAiBuffer.current = '';
  }, [saveRealtimeTranscripts]);

  const toggleRealtime = () => {
    if (realtimeActive) disconnectRealtime();
    else connectRealtime();
  };

  const getRealtimeLabel = () => {
    switch (realtimeState) {
      case SESSION_STATES.CONNECTING: return 'Conectando...';
      case SESSION_STATES.CONNECTED: return 'Habla para preguntar';
      case SESSION_STATES.LISTENING: return 'Escuchando...';
      case SESSION_STATES.AI_SPEAKING: return 'Respondiendo...';
      case SESSION_STATES.ERROR: return 'Error';
      default: return '';
    }
  };

  // Cleanup realtime on unmount or video change
  useEffect(() => {
    return () => {
      if (realtimeSessionRef.current) {
        realtimeSessionRef.current.disconnect();
        realtimeSessionRef.current = null;
      }
    };
  }, []);

  // ─── CHAT / QUIZ SUBMIT ───
  const submitMessage = async (msg) => {
    setChatExpanded(true);
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      if (quizActive) {
        const res = await mentor2Service.evaluateQuiz(
          documentId, videoActual.id, quizPregunta, msg
        );
        const data = res.data?.data || res.data;
        setChatMessages(prev => [...prev, { role: 'ai', text: data.mensaje }]);
        if (data.quiz_completo) { setQuizActive(false); setQuizCompleto(true); }
        else { setQuizPregunta(data.pregunta_actual); }
      } else {
        const res = await mentor2Service.chat({
          documentId: parseInt(documentId),
          videoId: videoActual.id,
          pregunta: msg,
          currentTime
        });
        const data = res.data?.data || res.data;
        setChatMessages(prev => [...prev, { role: 'ai', text: data.respuesta }]);
      }
    } catch (e) {
      console.error('Error en chat:', e);
      setChatMessages(prev => [...prev, {
        role: 'ai',
        text: 'Error al procesar tu mensaje. Intenta de nuevo.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    submitMessage(msg);
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatExpanded) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [chatMessages, chatExpanded, realtimePartial]);

  // ─── NAVIGATION ───
  const handleAdvance = async () => {
    try {
      setLoading(true);
      destroyPlayer();
      setChatMessages([]);
      setChatExpanded(false);
      setQuizActive(false);
      setQuizCompleto(false);
      setQuizPregunta(0);

      const res = await mentor2Service.advance(documentId);
      const data = res.data?.data || res.data;
      setMentorData(data);

      if (data.modulo_actual) {
        setExpandedModules(prev => ({ ...prev, [data.modulo_actual]: true }));
      }
    } catch (e) {
      console.error('Error al avanzar:', e);
      setError('Error al avanzar a la siguiente lección');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    if (!mentorData?.estructura?.modulos) return;
    const { modulo_actual, leccion_actual, estructura } = mentorData;

    let prevMod = modulo_actual;
    let prevLec = leccion_actual - 1;

    if (prevLec < 1) {
      prevMod = modulo_actual - 1;
      if (prevMod < 1) return;
      const modInfo = estructura.modulos[prevMod - 1];
      prevLec = modInfo?.lecciones?.length || 1;
    }

    loadLesson(prevMod, prevLec);
  };

  const loadLesson = async (moduleNum, lessonNum) => {
    try {
      setLoading(true);
      destroyPlayer();
      setChatMessages([]);
      setChatExpanded(false);
      setQuizActive(false);
      setQuizCompleto(false);

      const res = await mentor2Service.getVideoForLesson(documentId, moduleNum, lessonNum);
      // video-leccion.php returns { success, video: { id, titulo, vimeo_id, ... } }
      const videoData = res.data?.video || res.data?.data || res.data;

      if (!videoData?.id) {
        setError('No se encontró el video para esta lección');
        setLoading(false);
        return;
      }

      // Normalize field name (video-leccion returns titulo, start returns titulo_completo)
      if (!videoData.titulo_completo && videoData.titulo) {
        videoData.titulo_completo = videoData.titulo;
      }

      // Check if this is a completed video (replay mode)
      const videoInfo = mentorData.videos?.find(v => v.video_id === videoData.id);
      isReplay.current = !!(videoInfo?.completado);

      setMentorData(prev => ({
        ...prev,
        video_actual: {
          ...videoData,
          timestamp_actual: videoInfo?.timestamp_actual || 0,
          timestamp_maximo: videoInfo?.timestamp_maximo || 0,
          completado: videoInfo?.completado || 0
        },
        modulo_actual: moduleNum,
        leccion_actual: lessonNum
      }));

      setSidebarOpen(false);
    } catch (e) {
      console.error('Error cargando lección:', e);
      setError('Error al cargar la lección');
    } finally {
      setLoading(false);
    }
  };

  // ─── SIDEBAR HELPERS ───
  const toggleModule = (modNum) => {
    setExpandedModules(prev => ({ ...prev, [modNum]: !prev[modNum] }));
  };

  const getLessonStatus = (modNum, lecNum) => {
    if (!mentorData?.videos) return 'locked';
    const video = mentorData.videos.find(
      v => v.modulo_numero === modNum && v.leccion_numero === lecNum
    );
    if (video?.completado) return 'completed';
    if (modNum === mentorData.modulo_actual && lecNum === mentorData.leccion_actual) return 'current';

    // Allow access to completed + current lessons
    const isBeforeCurrent =
      modNum < mentorData.modulo_actual ||
      (modNum === mentorData.modulo_actual && lecNum < mentorData.leccion_actual);

    return isBeforeCurrent ? 'completed' : 'locked';
  };

  const getModuleStatus = (modNum) => {
    if (!mentorData?.estructura?.modulos) return 'locked';
    const modInfo = mentorData.estructura.modulos[modNum - 1];
    if (!modInfo) return 'locked';

    const allCompleted = modInfo.lecciones.every(
      (_, i) => getLessonStatus(modNum, i + 1) === 'completed'
    );
    if (allCompleted) return 'completed';
    if (modNum === mentorData.modulo_actual) return 'current';
    if (modNum < mentorData.modulo_actual) return 'completed';
    return 'locked';
  };

  const canAdvance = () => {
    if (mentorData?.estado === 'completado') return false;
    // Video must be completed and quiz must be completed
    const videoCompleted = videoActual?.completado || videoStatus === 'completed';
    return videoCompleted && (quizCompleto || isReplay.current);
  };

  const canGoPrevious = () => {
    if (!mentorData) return false;
    return mentorData.modulo_actual > 1 || mentorData.leccion_actual > 1;
  };

  // ─── RENDER ───
  if (loading && !mentorData) {
    return (
      <PageWrapper $light={lightMode} style={{ display: 'block' }}>
        <LoadingScreen>Cargando programa de estudio...</LoadingScreen>
      </PageWrapper>
    );
  }

  if (error && !mentorData) {
    return (
      <PageWrapper $light={lightMode} style={{ display: 'block' }}>
        <ErrorScreen>
          <div style={{ fontSize: '2rem' }}>!</div>
          <p>{error}</p>
          <NavBtn onClick={() => navigate('/documentos')}>Volver a Documentos</NavBtn>
        </ErrorScreen>
      </PageWrapper>
    );
  }

  if (!mentorData) return null;

  const { estructura, totales } = mentorData;

  return (
    <PageWrapper $light={lightMode} $collapsed={sidebarCollapsed} $right={sidebarRight}>
      {/* Sidebar overlay for mobile */}
      <SidebarOverlay $open={sidebarOpen} onClick={() => setSidebarOpen(false)} />

      {/* ─── SIDEBAR ─── */}
      <Sidebar $open={sidebarOpen} $collapsed={sidebarCollapsed} $right={sidebarRight}>
        <SidebarContent $collapsed={sidebarCollapsed}>
          <SidebarHeader>
            <SidebarHeaderRow>
              <BackButton onClick={() => navigate('/documentos')}>
                &larr; Documentos
              </BackButton>
              <SidebarAction
                onClick={toggleSidebarPosition}
                title={sidebarRight ? 'Mover sidebar a la izquierda' : 'Mover sidebar a la derecha'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                  <polyline points="21 18 15 12 21 6" />
                  <line x1="3" y1="6" x2="3" y2="18" />
                </svg>
              </SidebarAction>
            </SidebarHeaderRow>
            <ProgramTitle>{estructura?.titulo_programa || mentorData.document_title}</ProgramTitle>
            <ProgressBar>
              <ProgressFill $percent={totales?.porcentaje || 0} />
            </ProgressBar>
            <ProgressText>
              {totales?.lecciones_completadas || 0} / {totales?.total_lecciones || 0} lecciones ({totales?.porcentaje || 0}%)
            </ProgressText>
          </SidebarHeader>

          <ModuleList>
            {estructura?.modulos?.map((mod, mi) => {
              const modNum = mod.numero || mi + 1;
              const modStatus = getModuleStatus(modNum);

              return (
                <ModuleGroup key={modNum}>
                  <ModuleHeader
                    $status={modStatus}
                    onClick={() => toggleModule(modNum)}
                  >
                    {modStatus === 'completed' ? '\u2713' : modStatus === 'current' ? '\u25B6' : '\u25CB'}{' '}
                    {mod.titulo}
                  </ModuleHeader>

                  <LessonList $expanded={expandedModules[modNum]}>
                    {mod.lecciones?.map((lec, li) => {
                      const lecNum = lec.numero || li + 1;
                      const status = getLessonStatus(modNum, lecNum);
                      const isActive = modNum === mentorData.modulo_actual && lecNum === mentorData.leccion_actual;

                      return (
                        <LessonItem
                          key={lecNum}
                          $active={isActive}
                          $completed={status === 'completed'}
                          $locked={status === 'locked'}
                          onClick={() => {
                            if (status !== 'locked') {
                              loadLesson(modNum, lecNum);
                            }
                          }}
                        >
                          <StatusDot $completed={status === 'completed'} $active={isActive} />
                          {lec.titulo}
                        </LessonItem>
                      );
                    })}
                  </LessonList>
                </ModuleGroup>
              );
            })}
          </ModuleList>
        </SidebarContent>

        <CollapseTab
          $collapsed={sidebarCollapsed}
          $right={sidebarRight}
          onClick={toggleSidebarCollapse}
          title={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </CollapseTab>
      </Sidebar>

      {/* ─── MAIN AREA ─── */}
      <MainArea $right={sidebarRight}>
        {mentorData.estado === 'completado' && (
          <CompletedBanner>
            <h2>Programa Completado</h2>
            <p>Has completado todas las lecciones. Puedes repasar cualquier video desde la barra lateral.</p>
          </CompletedBanner>
        )}

        {/* Video Header */}
        <VideoSection>
          <VideoHeader>
            <HamburgerBtn onClick={() => setSidebarOpen(true)}>
              &#9776;
            </HamburgerBtn>
            <ThemeToggle $light={lightMode} onClick={toggleTheme} title={lightMode ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
              <ThemeIcon $side="left" $visible={lightMode}>&#9728;</ThemeIcon>
              <ThemeIcon $side="right" $visible={!lightMode}>&#9789;</ThemeIcon>
            </ThemeToggle>
            <VideoTitle>
              {videoActual?.titulo_completo || 'Cargando...'}
            </VideoTitle>
          </VideoHeader>

          {/* Video Player */}
          {videoActual?.vimeo_id ? (
            <VideoContainer onMouseMove={handleMouseMoveOnVideo}>
              <iframe
                key={playerKey}
                id={IFRAME_ID}
                src={`https://player.vimeo.com/video/${videoActual.vimeo_id}?h=${videoActual.hash_privacidad || ''}&autoplay=0&autopause=0&controls=0&muted=0&dnt=1&playsinline=1&transparent=0&responsive=1&keyboard=0&portrait=0&title=0&byline=0`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={videoActual.titulo_completo}
              />

              {/* Click area for play/pause */}
              {isPlayerReady && !showStartOverlay && (
                <ControlsClickArea onClick={handleVideoAreaClick} />
              )}

              {/* Big play button when paused */}
              {isPlayerReady && videoStatus !== 'playing' && videoStatus !== 'loading' && !showStartOverlay && (
                <BigPlayBtn onClick={togglePlayPause}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </BigPlayBtn>
              )}

              {/* Custom control bar */}
              {isPlayerReady && (
                <ControlsOverlay>
                  <ControlBar $visible={showControls || videoStatus !== 'playing'}>
                    <CtrlBtn onClick={togglePlayPause} title={videoStatus === 'playing' ? 'Pausar' : 'Reproducir'}>
                      {videoStatus === 'playing' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </CtrlBtn>
                    <CtrlBtn onClick={handleRewind10} title="Retroceder 10s">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="10" y="16" fontSize="7" textAnchor="middle" fill="currentColor">10</text></svg>
                    </CtrlBtn>
                    <TimeLabel>{formatTime(currentTime)}</TimeLabel>
                    <ProgressBarWrapper onClick={handleProgressClick}>
                      <MaxReachedBar $percent={Math.min(maxReachedPercent, 100)} />
                      <ProgressBarFill $percent={Math.min(progressPercent, 100)} />
                    </ProgressBarWrapper>
                    <TimeLabel>{formatTime(videoDuration)}</TimeLabel>
                  </ControlBar>
                </ControlsOverlay>
              )}

              {!isPlayerReady && <VideoLoader>Cargando video...</VideoLoader>}
              {showSeekWarning && <SeekWarning>No puedes adelantar el video</SeekWarning>}

              {showStartOverlay && (
                <VideoOverlay onClick={handleManualStart}>
                  <PlayButton>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </PlayButton>
                </VideoOverlay>
              )}
            </VideoContainer>
          ) : (
            <VideoContainer>
              <VideoLoader>No hay video disponible para esta lección</VideoLoader>
            </VideoContainer>
          )}
        </VideoSection>

        {/* Navigation */}
        <NavBar>
          <NavBtn
            onClick={handlePrevious}
            disabled={!canGoPrevious()}
          >
            &larr; Anterior
          </NavBtn>

          <NavStatus>
            {mentorData.estado === 'completado'
              ? 'Programa completado'
              : `Módulo ${mentorData.modulo_actual} - Lección ${mentorData.leccion_actual}`
            }
          </NavStatus>

          <NavBtn
            $primary
            onClick={handleAdvance}
            disabled={!canAdvance()}
          >
            Siguiente &rarr;
          </NavBtn>
        </NavBar>

        {/* Chat Section — collapsible */}
        <ChatSection $expanded={chatExpanded}>
          <ChatToggleRow>
            {quizActive ? (
              <ChatBadge $quiz>Quiz {quizPregunta}/3</ChatBadge>
            ) : (
              <ChatBadge>Chat</ChatBadge>
            )}
            <ChatInputRow onSubmit={handleChatSubmit}>
              <ChatInput
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={realtimeActive ? getRealtimeLabel() : quizActive ? 'Escribe tu respuesta...' : 'Pregunta sobre el video...'}
                disabled={chatLoading || realtimeActive}
              />
              {isRealtimeSupported() && !quizActive && (
                <MicBtn
                  type="button"
                  $recording={realtimeActive}
                  $state={realtimeState}
                  onClick={toggleRealtime}
                  disabled={chatLoading}
                  title={realtimeActive ? `Voz activa: ${getRealtimeLabel()} — click para desconectar` : 'Activar voz en tiempo real'}
                >
                  {realtimeActive ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                  )}
                </MicBtn>
              )}
              <SendBtn type="submit" disabled={!chatInput.trim() || chatLoading || realtimeActive}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </SendBtn>
            </ChatInputRow>
            {realtimeActive && realtimeState === SESSION_STATES.AI_SPEAKING && (
              <VoiceToggle
                type="button"
                $active
                onClick={() => realtimeSessionRef.current?.interrupt()}
                title="Interrumpir respuesta"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              </VoiceToggle>
            )}
            {(chatExpanded || chatMessages.length > 0) && (
              <ChatCollapseBtn
                $expanded={chatExpanded}
                onClick={() => setChatExpanded(prev => !prev)}
                title={chatExpanded ? 'Minimizar chat' : 'Expandir chat'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </ChatCollapseBtn>
            )}
          </ChatToggleRow>

          <ChatMessages>
            {chatMessages.length === 0 && !quizActive && !realtimeActive && (
              <ChatBubble $role="ai">
                Hola{mentorData.user_name ? `, ${mentorData.user_name}` : ''}. Escribe tu pregunta cuando quieras.
              </ChatBubble>
            )}
            {chatMessages.map((msg, i) => (
              <ChatBubble key={i} $role={msg.role === 'user' ? 'user' : 'ai'}>
                {msg.text}
              </ChatBubble>
            ))}
            {realtimePartial && (
              <ChatBubble $role="ai" style={{ opacity: 0.7 }}>
                {realtimePartial}
              </ChatBubble>
            )}
            {chatLoading && (
              <ChatBubble $role="ai" style={{ opacity: 0.5 }}>
                Pensando...
              </ChatBubble>
            )}
            {realtimeError && (
              <ChatBubble $role="ai" style={{ color: '#ef4444' }}>
                {realtimeError === 'REALTIME_NOT_AVAILABLE'
                  ? 'Modo voz no disponible. Usa el chat de texto.'
                  : realtimeError}
              </ChatBubble>
            )}
            <div ref={chatEndRef} />
          </ChatMessages>
        </ChatSection>
      </MainArea>
    </PageWrapper>
  );
};

export default MentorPage;
