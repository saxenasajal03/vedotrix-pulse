import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { NoticeItem, NoticeCategory, NoticePriority, Profile } from '../types';
import {
  Bell,
  Megaphone,
  Pin,
  Calendar,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  X,
  Search,
  CheckCircle,
  Building,
  UserCheck,
  Award,
  ShieldCheck,
  Download,
  Printer,
  Eye,
  FileCheck,
  Send,
  Users,
  User,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import jsPDF from 'jspdf';
import { formatISTDateTime, formatISTDate, getTodayISTDateString } from '../lib/serialUtils';

export const NoticeBoardView: React.FC = () => {
  const {
    currentOrg,
    currentProfile,
    orgProfiles,
    isVedotrixSuperadmin,
    notices,
    createNotice,
    deleteNotice,
    addToast
  } = useApp();

  // Administrative / Managerial authority
  const isHrOrSuperadmin =
    currentProfile?.role === 'hr' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'superadmin' ||
    isVedotrixSuperadmin;

  const directReports = useMemo(() => {
    return orgProfiles.filter((p) => p.managerId === currentProfile?.id);
  }, [orgProfiles, currentProfile]);

  const isManager = directReports.length > 0 || currentProfile?.role === 'manager';
  const canCreateLetter = isHrOrSuperadmin || isManager;

  // Main Tabs: 'notices' (Circulars) vs 'letters' (Notification Letters & Orders)
  const [mainTab, setMainTab] = useState<'notices' | 'letters'>('notices');

  // Notices Tab States
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Post Notice Modal States
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<NoticeCategory>('announcement');
  const [noticePriority, setNoticePriority] = useState<NoticePriority>('medium');
  const [noticePinned, setNoticePinned] = useState(false);
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);

  // Letters Tab States
  const [letterFilterType, setLetterFilterType] = useState<string>('all');
  const [letterSearchQuery, setLetterSearchQuery] = useState('');
  const [selectedLetterForView, setSelectedLetterForView] = useState<NoticeItem | null>(null);

  // Create Letter Modal States
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [letterType, setLetterType] = useState<'warning' | 'appreciation' | 'experience' | 'directive' | 'notice'>('warning');
  const [recipientType, setRecipientType] = useState<'all' | 'individual'>('individual');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [letterRefNumber, setLetterRefNumber] = useState('');
  const [letterSubject, setLetterSubject] = useState('');
  const [letterBody, setLetterBody] = useState('');
  const [signatoryName, setSignatoryName] = useState(
    `${currentProfile?.firstName || ''} ${currentProfile?.lastName || ''}`.trim()
  );
  const [signatoryRole, setSignatoryRole] = useState(
    currentProfile?.designation || currentProfile?.role?.toUpperCase() || 'Authorized Signatory'
  );
  const [isDigitallyStamped, setIsDigitallyStamped] = useState(true);
  const [isLetterSubmitting, setIsLetterSubmitting] = useState(false);

  // Categorize notices into Circulars vs Letters
  const { circularNotices, letterNotices } = useMemo(() => {
    const circulars: NoticeItem[] = [];
    const letters: NoticeItem[] = [];

    notices.forEach((n) => {
      // Must be scoped to current org or Vedotrix Superadmin
      if (currentOrg && n.orgId && n.orgId !== currentOrg.id && !isVedotrixSuperadmin) return;

      if (n.isLetter || n.refNumber) {
        // Hierarchy access check:
        // Superadmin/HR: see all letters
        // Manager: see broadcast, self, or direct reports' letters
        // Employee: see broadcast or letters addressed directly to them
        if (isHrOrSuperadmin) {
          letters.push(n);
        } else if (isManager) {
          const directReportIds = new Set(directReports.map((d) => d.id));
          if (
            n.recipientType === 'all' ||
            n.recipientId === currentProfile.id ||
            (n.recipientId && directReportIds.has(n.recipientId)) ||
            n.authorId === currentProfile.id
          ) {
            letters.push(n);
          }
        } else {
          if (n.recipientType === 'all' || n.recipientId === currentProfile.id) {
            letters.push(n);
          }
        }
      } else {
        circulars.push(n);
      }
    });

    return { circularNotices: circulars, letterNotices: letters };
  }, [notices, currentOrg, isVedotrixSuperadmin, isHrOrSuperadmin, isManager, directReports, currentProfile]);

  // Filtered Circular Notices
  const filteredCirculars = useMemo(() => {
    return circularNotices.filter((notice) => {
      if (activeCategory === 'pinned') return notice.isPinned;
      if (activeCategory !== 'all' && notice.category !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          notice.title.toLowerCase().includes(q) ||
          notice.content.toLowerCase().includes(q) ||
          notice.authorName.toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [circularNotices, activeCategory, searchQuery]);

  // Filtered Notification Letters
  const filteredLetters = useMemo(() => {
    return letterNotices.filter((letter) => {
      if (letterFilterType !== 'all') {
        const effectiveType = letter.letterType || (letter.category as any);
        if (effectiveType !== letterFilterType) return false;
      }
      if (letterSearchQuery.trim()) {
        const q = letterSearchQuery.toLowerCase();
        return (
          (letter.refNumber && letter.refNumber.toLowerCase().includes(q)) ||
          letter.title.toLowerCase().includes(q) ||
          letter.content.toLowerCase().includes(q) ||
          (letter.recipientName && letter.recipientName.toLowerCase().includes(q)) ||
          (letter.authorName && letter.authorName.toLowerCase().includes(q)) ||
          (letter.signatoryName && letter.signatoryName.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [letterNotices, letterFilterType, letterSearchQuery]);

  // Handle standard template autofill
  const loadLetterTemplate = (
    type: 'warning' | 'appreciation' | 'experience' | 'directive' | 'notice',
    emp?: Profile
  ) => {
    const orgName = currentOrg.name || 'Vedotrix Technologies';
    const targetName = emp ? `${emp.firstName} ${emp.lastName}` : '[Employee Name]';
    const targetDesig = emp ? emp.designation : '[Designation]';
    const targetDept = emp ? emp.department : '[Department]';
    const todayStr = formatISTDate(new Date().toISOString());

    switch (type) {
      case 'warning':
        setLetterSubject(`Formal Notice Regarding Attendance & Workplace Adherence - ${targetName}`);
        setLetterBody(
          `Dear ${targetName},\n\nThis official notification letter is being issued to draw your immediate attention to repeated irregularities observed regarding attendance, scheduled shift adherence, or workplace guidelines over the recent period.\n\nAs an organization, ${orgName} holds high standards of punctuality, professionalism, and accountability. Repeated unplanned absences or unregularized check-ins cause substantial disruptions to team delivery milestones.\n\nYou are hereby advised to submit a formal clarification regarding the observed irregularities to the HR / Reporting Manager within 48 hours of receipt of this communication. Please treat this communication as a formal warning.\n\nContinued failure to meet the required work standards may lead to further administrative action in accordance with company policy. We trust that you will take this communication constructively and realign your workplace performance immediately.`
        );
        break;

      case 'appreciation':
        setLetterSubject(`Letter of Commendation & Recognition - ${targetName}`);
        setLetterBody(
          `Dear ${targetName},\n\nOn behalf of the leadership and management team at ${orgName}, it gives us immense pleasure to present this official Letter of Appreciation in recognition of your exceptional performance, dedication, and exemplary contributions to our organization.\n\nYour work ethic, problem-solving mindset, and dedication during recent deliverables have set a benchmark of excellence for the entire team. Your initiative has played a key role in driving high-impact results for the organization.\n\nWe deeply value your commitment, creativity, and enthusiasm. Thank you for your continued dedication, and we look forward to achieving many more milestones together in the future.\n\nKeep up the outstanding work!`
        );
        break;

      case 'experience':
        setLetterSubject(`Experience Certificate & Relieving Order - ${targetName}`);
        setLetterBody(
          `TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that ${targetName} was employed with ${orgName} as a ${targetDesig} in the ${targetDept} department from ${emp?.joiningDate ? formatISTDate(emp.joiningDate) : '[Joining Date]'} to ${todayStr}.\n\nDuring their tenure with us, ${targetName} was found to be hardworking, disciplined, and dedicated to assigned responsibilities. They consistently demonstrated strong professional ethics and teamwork.\n\nAll organizational assets, documentation, and operational responsibilities have been duly handed over in accordance with company clearance protocols. ${targetName} is relieved from their duties with effect from the close of business hours on ${todayStr}.\n\nWe thank them for their valuable contributions to ${orgName} and wish them the very best in all their future personal and professional endeavors.`
        );
        break;

      case 'directive':
        setLetterSubject(`Executive Policy Directive & Standard Operating Procedures`);
        setLetterBody(
          `Dear Team Members,\n\nThis executive notification letter sets forth official operational directives and statutory compliance protocols effective immediately across all departments at ${orgName}.\n\n1. Attendance & Shift Regularity: All team members are required to log their daily check-in through the official HRMS portal within the designated grace period.\n2. Leave Application Protocol: Planned leaves must be applied at least 48 hours in advance and approved by the respective Reporting Manager.\n3. Confidentiality & Intellectual Property: All proprietary codebase, customer information, and trade secrets remain strictly confidential in accordance with non-disclosure obligations.\n\nAll Department Heads and Team Managers are instructed to ensure strict compliance with this directive across their teams.`
        );
        break;

      case 'notice':
      default:
        setLetterSubject(`Official Notification & Corporate Order`);
        setLetterBody(
          `Dear All Employees / Team Members,\n\nThis official notification is issued to communicate important organizational announcements and operational updates regarding company operations at ${orgName}.\n\nPlease review the attached guidelines thoroughly and contact HR or your Department Lead for any necessary clarifications.\n\nWe appreciate your ongoing dedication and cooperation.`
        );
        break;
    }
  };

  const handleOpenNoticeModal = () => {
    setNoticeTitle('');
    setNoticeContent('');
    setNoticeCategory('announcement');
    setNoticePriority('medium');
    setNoticePinned(false);
    setIsNoticeModalOpen(true);
  };

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      addToast('Incomplete Form', 'Please provide a notice title and content description.', 'warning');
      return;
    }

    setNoticeSubmitting(true);
    try {
      await createNotice({
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        category: noticeCategory,
        priority: noticePriority,
        authorId: currentProfile.id,
        authorName: `${currentProfile.firstName} ${currentProfile.lastName}`.trim(),
        authorRole: currentProfile.role,
        date: new Date().toISOString(),
        isPinned: noticePinned
      });

      setIsNoticeModalOpen(false);
    } catch (err) {
      addToast('Error', 'Failed to publish notice.', 'error');
    } finally {
      setNoticeSubmitting(false);
    }
  };

  const handleOpenLetterModal = () => {
    const nextNum = letterNotices.length + 1;
    const generatedRef = `REF: ${currentOrg.orgCode || 'ORG'}/NL/${new Date().getFullYear()}/${String(nextNum).padStart(3, '0')}`;
    setLetterRefNumber(generatedRef);
    setLetterType('warning');
    setRecipientType('individual');
    setSelectedRecipientId(orgProfiles[0]?.id || '');

    const firstEmp = orgProfiles[0];
    loadLetterTemplate('warning', firstEmp);

    setSignatoryName(`${currentProfile?.firstName || ''} ${currentProfile?.lastName || ''}`.trim());
    setSignatoryRole(currentProfile?.designation || currentProfile?.role?.toUpperCase() || 'Authorized Signatory');
    setIsDigitallyStamped(true);
    setIsLetterModalOpen(true);
  };

  const handleRecipientChange = (empId: string) => {
    setSelectedRecipientId(empId);
    const emp = orgProfiles.find((p) => p.id === empId);
    loadLetterTemplate(letterType, emp);
  };

  const handleLetterTypeChange = (type: typeof letterType) => {
    setLetterType(type);
    const emp = recipientType === 'individual' ? orgProfiles.find((p) => p.id === selectedRecipientId) : undefined;
    loadLetterTemplate(type, emp);
  };

  const handleCreateLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!letterSubject.trim() || !letterBody.trim() || !letterRefNumber.trim()) {
      addToast('Incomplete Letter', 'Please provide Reference Number, Subject, and Letter Content.', 'warning');
      return;
    }

    const recipientEmp = recipientType === 'individual' ? orgProfiles.find((p) => p.id === selectedRecipientId) : undefined;

    setIsLetterSubmitting(true);
    try {
      await createNotice({
        title: letterSubject.trim(),
        content: letterBody.trim(),
        category: (letterType === 'directive' ? 'directive' : letterType === 'warning' ? 'warning' : letterType === 'appreciation' ? 'appreciation' : letterType === 'experience' ? 'experience' : 'notice') as any,
        priority: letterType === 'warning' ? 'high' : 'medium',
        authorId: currentProfile.id,
        authorName: `${currentProfile.firstName} ${currentProfile.lastName}`.trim(),
        authorRole: currentProfile.role,
        date: new Date().toISOString(),
        isPinned: false,

        // Official Notification Letter fields
        isLetter: true,
        letterType,
        refNumber: letterRefNumber.trim(),
        recipientType,
        recipientId: recipientEmp?.id || (recipientType === 'all' ? 'all' : undefined),
        recipientName: recipientEmp ? `${recipientEmp.firstName} ${recipientEmp.lastName}`.trim() : 'All Employees',
        recipientDesig: recipientEmp?.designation || '',
        recipientDept: recipientEmp?.department || '',
        recipientEmail: recipientEmp?.email || '',
        signatoryName: signatoryName.trim() || `${currentProfile.firstName} ${currentProfile.lastName}`.trim(),
        signatoryRole: signatoryRole.trim() || currentProfile.role.toUpperCase(),
        isDigitallyStamped,
        stampDate: new Date().toISOString()
      });

      setIsLetterModalOpen(false);
    } catch (err) {
      addToast('Error', 'Failed to issue notification letter.', 'error');
    } finally {
      setIsLetterSubmitting(false);
    }
  };

  // Vector PDF Generator using jsPDF
  const handleDownloadLetterPDF = (letter: NoticeItem) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 595 pt
      const pageHeight = doc.internal.pageSize.getHeight(); // 842 pt
      const margin = 45;
      const contentWidth = pageWidth - margin * 2;

      // 1. Top Decorative Brand Stripes
      doc.setFillColor(30, 41, 59); // slate-900
      doc.rect(0, 0, pageWidth, 8, 'F');
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 8, pageWidth, 3, 'F');

      let currentY = 38;

      // 2. Company Letterhead Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(currentOrg.name.toUpperCase(), margin, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      currentY += 14;
      doc.text(`Organization Code: ${currentOrg.orgCode} | Industry: ${currentOrg.industry || 'Technology Solutions'}`, margin, currentY);

      // Right-aligned Corporate Contact Info
      const rightX = pageWidth - margin;
      let contactY = 35;
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      if (currentOrg.website) {
        doc.text(currentOrg.website, rightX, contactY, { align: 'right' });
        contactY += 12;
      }
      if (currentOrg.phone) {
        doc.text(`Tel: ${currentOrg.phone}`, rightX, contactY, { align: 'right' });
        contactY += 12;
      }
      if (currentOrg.address) {
        const addrLines = doc.splitTextToSize(currentOrg.address, 200);
        doc.text(addrLines, rightX, contactY, { align: 'right' });
      }

      currentY += 28;

      // 3. Elegant Dividing Rule
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(1);
      doc.line(margin, currentY, rightX, currentY);

      currentY += 18;

      // 4. Reference Number & Date Bar
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(margin, currentY, contentWidth, 24, 4, 4, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, 24, 4, 4, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`REF NO: ${letter.refNumber || 'REF: VDX/NL/2026/001'}`, margin + 12, currentY + 16);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const issueDateText = `DATE: ${formatISTDate(letter.date || letter.createdAt)}`;
      doc.text(issueDateText, rightX - 12, currentY + 16, { align: 'right' });

      currentY += 40;

      // 5. Recipient Details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('TO:', margin, currentY);
      currentY += 14;

      if (letter.recipientType === 'individual' && letter.recipientName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(letter.recipientName, margin, currentY);
        currentY += 14;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        const roleDept = [letter.recipientDesig, letter.recipientDept].filter(Boolean).join(' • ');
        if (roleDept) {
          doc.text(roleDept, margin, currentY);
          currentY += 13;
        }
        if (letter.recipientEmail) {
          doc.text(letter.recipientEmail, margin, currentY);
          currentY += 13;
        }
        doc.text(currentOrg.name, margin, currentY);
        currentY += 18;
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(`ALL STAFF MEMBERS & EMPLOYEES`, margin, currentY);
        currentY += 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`${currentOrg.name} Corporate Enterprise`, margin, currentY);
        currentY += 20;
      }

      // 6. Subject Line with subtle accent background
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(margin, currentY, contentWidth, 26, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`SUBJECT: ${letter.title.toUpperCase()}`, margin + 12, currentY + 17);

      currentY += 42;

      // 7. Letter Body Content
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // slate-700

      const splitLines = doc.splitTextToSize(letter.content, contentWidth);
      splitLines.forEach((line: string) => {
        if (currentY > pageHeight - 160) {
          doc.addPage();
          currentY = 50;
        }
        doc.text(line, margin, currentY);
        currentY += 16;
      });

      currentY += 24;

      // Ensure space for Signatory & Digital Stamp
      if (currentY > pageHeight - 160) {
        doc.addPage();
        currentY = 60;
      }

      // 8. Sign-off and Authorized Signatory Block
      const signBlockY = currentY;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Yours faithfully / Sincerely,', margin, signBlockY);

      doc.setFont('times', 'italic');
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138); // blue-900 signature style
      doc.text(letter.signatoryName || letter.authorName, margin, signBlockY + 28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(letter.signatoryName || letter.authorName, margin, signBlockY + 44);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(letter.signatoryRole || letter.authorRole, margin, signBlockY + 57);
      doc.text(currentOrg.name, margin, signBlockY + 69);

      // 9. Vector Digital Stamping Seal Graphic
      if (letter.isDigitallyStamped !== false) {
        const stampX = rightX - 60;
        const stampY = signBlockY + 36;

        // Stamp theme color based on letter type
        let stampColor: [number, number, number] = [29, 78, 216]; // blue-700
        if (letter.letterType === 'warning') stampColor = [185, 28, 28]; // red-700
        else if (letter.letterType === 'appreciation') stampColor = [4, 120, 87]; // emerald-700
        else if (letter.letterType === 'experience') stampColor = [109, 40, 217]; // violet-700

        doc.setDrawColor(...stampColor);
        doc.setTextColor(...stampColor);

        // Outer Ring
        doc.setLineWidth(1.8);
        doc.circle(stampX, stampY, 44);

        // Inner Dotted / Secondary Ring
        doc.setLineWidth(0.8);
        doc.circle(stampX, stampY, 38);

        // Center Text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text(`★ ${currentOrg.orgCode || 'VDX'} OFFICIAL SEAL ★`, stampX, stampY - 18, { align: 'center' });

        doc.setFontSize(8);
        doc.text('OFFICIALLY', stampX, stampY - 6, { align: 'center' });
        doc.text('DIGITALLY', stampX, stampY + 4, { align: 'center' });
        doc.text('VERIFIED', stampX, stampY + 14, { align: 'center' });

        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.text('PULSE HRMS CLOUD', stampX, stampY + 24, { align: 'center' });
        doc.text(`ID: ${(letter.id || 'SEC').slice(0, 8).toUpperCase()}`, stampX, stampY + 31, { align: 'center' });
      }

      // 10. Legal Security Bottom Footer
      const footerY = pageHeight - 32;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.8);
      doc.line(margin, footerY - 10, rightX, footerY - 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        'This is an official computer-generated corporate document authenticated by Vedotrix Pulse HRMS. Digitally stamped & cryptographically logged.',
        margin,
        footerY
      );
      doc.text(`Page 1 of 1 • ${currentOrg.orgCode}`, rightX, footerY, { align: 'right' });

      // Save & Trigger Download
      const safeFilename = `${(letter.refNumber || 'Letter').replace(/[^a-zA-Z0-9_-]/g, '_')}_${letter.title.slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      doc.save(safeFilename);
      addToast('PDF Downloaded 📄', `Exported "${letter.title}" as corporate letterhead PDF.`, 'success');
    } catch (err) {
      console.error('Letter PDF error:', err);
      addToast('Export Failed', 'Could not generate letterhead PDF.', 'error');
    }
  };

  const getLetterBadgeMeta = (type?: string) => {
    switch (type) {
      case 'warning':
        return { label: 'Warning / Show Cause', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertTriangle };
      case 'appreciation':
        return { label: 'Appreciation & Award', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Award };
      case 'experience':
        return { label: 'Experience / Relieving', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: FileCheck };
      case 'directive':
        return { label: 'Policy Directive', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: ShieldCheck };
      default:
        return { label: 'Official Circular', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Megaphone };
    }
  };

  const getCategoryMeta = (cat: NoticeCategory) => {
    switch (cat) {
      case 'holiday':
        return { label: 'Company Holiday 🌴', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Calendar };
      case 'policy':
        return { label: 'Policy Update 📜', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: FileText };
      case 'urgent':
        return { label: 'Urgent Alert 🚨', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertTriangle };
      default:
        return { label: 'Announcement 📢', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Megaphone };
    }
  };

  const getPriorityBadge = (p: NoticePriority) => {
    switch (p) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white uppercase animate-pulse">Critical</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white uppercase">High Priority</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 uppercase">Routine</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 uppercase">Standard</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Megaphone className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Corporate Communications & Notices 📢
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Broadcast announcements, official notification letters, warnings, commendations, and executive orders.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0 flex-wrap gap-y-2">
          {/* Post Regular Notice Button */}
          {isHrOrSuperadmin && (
            <button
              onClick={handleOpenNoticeModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
            >
              <Megaphone className="w-3.5 h-3.5 text-slate-600" />
              <span>Post Notice</span>
            </button>
          )}

          {/* Issue Official Notification Letter Button (Manager / HR / Superadmin) */}
          {canCreateLetter && (
            <button
              onClick={handleOpenLetterModal}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <FileCheck className="w-4 h-4" />
              <span>+ Issue Notification Letter</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Top Tabs: Circulars vs Letters */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setMainTab('notices')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-xs transition ${
            mainTab === 'notices'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Broadcast Notices ({circularNotices.length})</span>
        </button>

        <button
          onClick={() => setMainTab('letters')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-xs transition ${
            mainTab === 'letters'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Notification Letters & Orders ({letterNotices.length})</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-800 font-extrabold">
            PDF & Seal
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SECTION A: BROADCAST NOTICES & CIRCULARS */}
      {/* ===================================================================== */}
      {mainTab === 'notices' && (
        <div className="space-y-4">
          {/* Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Circulars' },
                { id: 'pinned', label: 'Pinned 📌' },
                { id: 'announcement', label: 'Announcements 📢' },
                { id: 'policy', label: 'Policy Updates 📜' },
                { id: 'holiday', label: 'Holidays 🌴' },
                { id: 'urgent', label: 'Urgent 🚨' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    activeCategory === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search circulars, topics..."
                className="w-full px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notice Cards */}
          {filteredCirculars.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Circulars Published</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                There are currently no active corporate announcements or circulars under this filter.
              </p>
              {isHrOrSuperadmin && (
                <button
                  onClick={handleOpenNoticeModal}
                  className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs transition"
                >
                  + Post First Notice
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCirculars.map((notice) => {
                const meta = getCategoryMeta(notice.category);
                const CategoryIcon = meta.icon;

                return (
                  <div
                    key={notice.id}
                    className={`bg-white rounded-2xl border transition shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-5 relative overflow-hidden ${
                      notice.isPinned
                        ? 'border-amber-300 ring-1 ring-amber-100/70 bg-gradient-to-r from-amber-50/20 to-transparent'
                        : 'border-slate-100'
                    }`}
                  >
                    {/* Notice Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${meta.color}`}
                        >
                          <CategoryIcon className="w-3 h-3 mr-1" />
                          {meta.label}
                        </span>

                        {getPriorityBadge(notice.priority)}

                        {notice.isPinned && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            <Pin className="w-3 h-3 mr-1 text-amber-600 fill-amber-600" />
                            PINNED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-400">
                        <span className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {formatISTDateTime(notice.date || notice.createdAt)}
                        </span>

                        {isHrOrSuperadmin && (
                          <button
                            onClick={() => deleteNotice(notice.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1"
                            title="Delete Notice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notice Body */}
                    <div className="mt-3">
                      <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                        {notice.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
                        {notice.content}
                      </p>
                    </div>

                    {/* Notice Footer Author */}
                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center space-x-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Published by:</span>
                        <span className="font-bold text-slate-800">{notice.authorName}</span>
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] uppercase font-bold">
                          {notice.authorRole}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400">
                        {currentOrg.name} Corporate Circular
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION B: NOTIFICATION LETTERS & EXECUTIVE ORDERS */}
      {/* ===================================================================== */}
      {mainTab === 'letters' && (
        <div className="space-y-4">
          {/* Letters Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Letters' },
                { id: 'warning', label: 'Warnings ⚠️' },
                { id: 'appreciation', label: 'Appreciation 🌟' },
                { id: 'experience', label: 'Experience / Relieving 🎓' },
                { id: 'directive', label: 'Policy Directives 📑' },
                { id: 'notice', label: 'Official Orders 📢' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLetterFilterType(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    letterFilterType === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                value={letterSearchQuery}
                onChange={(e) => setLetterSearchQuery(e.target.value)}
                placeholder="Search by Ref #, Employee, Subject..."
                className="w-full px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Letters Cards Grid */}
          {filteredLetters.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Notification Letters Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No formal corporate letters or orders match the selected criteria.
              </p>
              {canCreateLetter && (
                <button
                  onClick={handleOpenLetterModal}
                  className="mt-4 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl text-xs transition"
                >
                  + Issue First Notification Letter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLetters.map((letter) => {
                const badge = getLetterBadgeMeta(letter.letterType);
                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={letter.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 transition shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-5 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Badge, Ref No & Delete */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${badge.color}`}>
                            <BadgeIcon className="w-3 h-3 mr-1" />
                            {badge.label}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {letter.refNumber || 'REF: OFFICIAL'}
                          </span>
                        </div>

                        {isHrOrSuperadmin && (
                          <button
                            onClick={() => deleteNotice(letter.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1"
                            title="Delete Letter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Recipient Details */}
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1.5 text-slate-700">
                          {letter.recipientType === 'all' ? (
                            <span className="flex items-center font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                              <Users className="w-3.5 h-3.5 mr-1" />
                              All Staff Broadcast
                            </span>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <User className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="font-bold text-slate-900">{letter.recipientName || 'Employee'}</span>
                              {letter.recipientDesig && (
                                <span className="text-[10px] text-slate-400">({letter.recipientDesig})</span>
                              )}
                            </div>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400">
                          {formatISTDate(letter.date || letter.createdAt)}
                        </span>
                      </div>

                      {/* Subject & Preview */}
                      <div className="mt-2.5">
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                          {letter.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
                          {letter.content}
                        </p>
                      </div>

                      {/* Digital Stamping Badge */}
                      {letter.isDigitallyStamped !== false && (
                        <div className="mt-3 inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] font-bold border border-emerald-200">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Digitally Stamped & Verified • Ref #{letter.refNumber?.slice(-6) || 'SEC'}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[10px] text-slate-400">
                        Signatory: <span className="font-semibold text-slate-700">{letter.signatoryName || letter.authorName}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* View Letterhead Modal */}
                        <button
                          onClick={() => setSelectedLetterForView(letter)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>View</span>
                        </button>

                        {/* Export PDF */}
                        <button
                          onClick={() => handleDownloadLetterPDF(letter)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: CREATE NOTIFICATION LETTER MODAL */}
      {/* ===================================================================== */}
      {isLetterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Issue Corporate Notification Letter</h3>
                  <p className="text-[11px] text-slate-500">
                    Official letterhead with digital stamping, reference numbering, and vector PDF export.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLetterModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLetter} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Row 1: Letter Type & Reference Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Letter Type *</label>
                  <select
                    value={letterType}
                    onChange={(e) => handleLetterTypeChange(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="warning">Warning / Show Cause Notice ⚠️</option>
                    <option value="appreciation">Letter of Appreciation & Recognition 🌟</option>
                    <option value="experience">Experience / Relieving Certificate 🎓</option>
                    <option value="directive">Policy Directive & Compliance 📑</option>
                    <option value="notice">General Executive Order / Circular 📢</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Reference Number *</label>
                  <input
                    type="text"
                    required
                    value={letterRefNumber}
                    onChange={(e) => setLetterRefNumber(e.target.value)}
                    placeholder="e.g. REF: VDX/NL/2026/001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 2: Recipient Scope */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Recipient Scope</label>
                  <div className="flex items-center space-x-3 text-xs">
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="recipientType"
                        value="individual"
                        checked={recipientType === 'individual'}
                        onChange={() => {
                          setRecipientType('individual');
                          const emp = orgProfiles.find((p) => p.id === selectedRecipientId);
                          loadLetterTemplate(letterType, emp);
                        }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700 font-medium">Specific Employee</span>
                    </label>

                    <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="recipientType"
                        value="all"
                        checked={recipientType === 'all'}
                        onChange={() => {
                          setRecipientType('all');
                          loadLetterTemplate(letterType, undefined);
                        }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700 font-medium">All Employees (Broadcast)</span>
                    </label>
                  </div>
                </div>

                {recipientType === 'individual' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Employee *</label>
                    <select
                      value={selectedRecipientId}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {orgProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} — {p.designation} ({p.department})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Letter Subject *</label>
                <input
                  type="text"
                  required
                  value={letterSubject}
                  onChange={(e) => setLetterSubject(e.target.value)}
                  placeholder="e.g. Formal Notice Regarding Attendance & Work Adherence"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Letter Body Text */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Official Body Text *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const emp = recipientType === 'individual' ? orgProfiles.find((p) => p.id === selectedRecipientId) : undefined;
                      loadLetterTemplate(letterType, emp);
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Reset to Standard Template</span>
                  </button>
                </div>
                <textarea
                  rows={7}
                  required
                  value={letterBody}
                  onChange={(e) => setLetterBody(e.target.value)}
                  placeholder="Write or edit the official letter content..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans leading-relaxed"
                />
              </div>

              {/* Row 3: Authorized Signatory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Signatory Name</label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Signatory Designation / Role</label>
                  <input
                    type="text"
                    value={signatoryRole}
                    onChange={(e) => setSignatoryRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Digital Stamping Checkbox */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between">
                <label className="flex items-center space-x-2 text-xs text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDigitallyStamped}
                    onChange={(e) => setIsDigitallyStamped(e.target.checked)}
                    className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                    Apply Official Digital Seal & Cryptographic Authentication
                  </span>
                </label>
                <span className="text-[10px] text-emerald-700 font-semibold uppercase">
                  Verified HRMS Stamping
                </span>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLetterModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLetterSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 inline-flex items-center space-x-1.5"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{isLetterSubmitting ? 'Issuing & Stamping...' : 'Issue & Publish Letter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: POST REGULAR NOTICE MODAL */}
      {/* ===================================================================== */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Post Corporate Notice</h3>
                  <p className="text-[11px] text-slate-500">
                    Will be broadcasted to all {currentOrg.name} staff members.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNoticeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostNotice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Title *</label>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="e.g. Q4 Company Holidays & Work Schedules"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={noticeCategory}
                    onChange={(e) => setNoticeCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="announcement">Announcement 📢</option>
                    <option value="policy">Policy Update 📜</option>
                    <option value="holiday">Company Holiday 🌴</option>
                    <option value="urgent">Urgent Alert 🚨</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={noticePriority}
                    onChange={(e) => setNoticePriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="low">Low (Routine)</option>
                    <option value="medium">Standard</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Content / Circular Details *</label>
                <textarea
                  rows={4}
                  required
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  placeholder="Enter the full official notice details..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noticePinned}
                    onChange={(e) => setNoticePinned(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold flex items-center">
                    <Pin className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    Pin this notice to top of the Corporate Board
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNoticeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={noticeSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {noticeSubmitting ? 'Publishing...' : 'Publish Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: LETTERHEAD VIEWER & DIGITAL STAMP MODAL */}
      {/* ===================================================================== */}
      {selectedLetterForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200">
            {/* Top Toolbar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold font-mono tracking-wide">
                  {selectedLetterForView.refNumber || 'OFFICIAL LETTERHEAD'}
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] bg-indigo-500/30 text-indigo-200 uppercase font-bold border border-indigo-500/40">
                  {selectedLetterForView.letterType || selectedLetterForView.category}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadLetterPDF(selectedLetterForView)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                <button
                  onClick={() => setSelectedLetterForView(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* A4 Letterhead Sheet Representation */}
            <div className="p-8 sm:p-12 bg-white text-slate-900 max-h-[80vh] overflow-y-auto selection:bg-indigo-100">
              {/* Letterhead Top Banner */}
              <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {currentOrg.name.toUpperCase()}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    Org Code: <span className="font-mono font-bold text-slate-800">{currentOrg.orgCode}</span> &bull; {currentOrg.industry || 'Technology & Digital Services'}
                  </p>
                </div>

                <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                  {currentOrg.website && <div className="font-medium text-indigo-700">{currentOrg.website}</div>}
                  {currentOrg.phone && <div>Tel: {currentOrg.phone}</div>}
                  {currentOrg.address && <div className="max-w-xs">{currentOrg.address}</div>}
                </div>
              </div>

              {/* Reference & Date Strip */}
              <div className="flex items-center justify-between py-3 my-4 px-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-slate-800">REF NO:</span>{' '}
                  <span className="font-mono text-slate-700 font-bold">{selectedLetterForView.refNumber || 'REF: VDX/NL/2026/001'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">DATE:</span>{' '}
                  <span className="text-slate-700">{formatISTDate(selectedLetterForView.date || selectedLetterForView.createdAt)}</span>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="my-6 text-xs text-slate-800 space-y-1">
                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">To:</div>
                {selectedLetterForView.recipientType === 'individual' && selectedLetterForView.recipientName ? (
                  <>
                    <div className="text-sm font-bold text-slate-900">{selectedLetterForView.recipientName}</div>
                    <div className="text-slate-600">
                      {[selectedLetterForView.recipientDesig, selectedLetterForView.recipientDept].filter(Boolean).join(' • ')}
                    </div>
                    {selectedLetterForView.recipientEmail && (
                      <div className="text-slate-500 text-[11px]">{selectedLetterForView.recipientEmail}</div>
                    )}
                    <div className="text-slate-600">{currentOrg.name}</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-slate-900">ALL EMPLOYEES & STAFF MEMBERS</div>
                    <div className="text-slate-600">{currentOrg.name} Corporate Enterprise</div>
                  </>
                )}
              </div>

              {/* Subject Line */}
              <div className="my-6 p-3 bg-slate-100 rounded-lg border-l-4 border-indigo-600">
                <div className="text-xs font-bold text-slate-900 uppercase">
                  SUBJECT: {selectedLetterForView.title}
                </div>
              </div>

              {/* Letter Content */}
              <div className="my-6 text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                {selectedLetterForView.content}
              </div>

              {/* Signatory & Stamping Row */}
              <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="text-xs text-slate-500">Yours faithfully,</div>
                  <div className="text-lg font-serif italic text-blue-900 my-2 font-bold">
                    {selectedLetterForView.signatoryName || selectedLetterForView.authorName}
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    {selectedLetterForView.signatoryName || selectedLetterForView.authorName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedLetterForView.signatoryRole || selectedLetterForView.authorRole}
                  </div>
                  <div className="text-[11px] text-slate-500">{currentOrg.name}</div>
                </div>

                {/* Digital Stamp Seal */}
                {selectedLetterForView.isDigitallyStamped !== false && (
                  <div className="w-28 h-28 rounded-full border-2 border-indigo-700 p-1 flex flex-col items-center justify-center text-center text-indigo-800 relative bg-indigo-50/20 shadow-xs rotate-[-6deg]">
                    <div className="w-full h-full rounded-full border border-dashed border-indigo-500 flex flex-col items-center justify-center p-1">
                      <div className="text-[6.5px] font-black uppercase tracking-tight">
                        ★ {currentOrg.orgCode || 'VDX'} SEAL ★
                      </div>
                      <div className="text-[8px] font-black uppercase tracking-wider text-indigo-900 my-0.5">
                        DIGITALLY VERIFIED
                      </div>
                      <div className="text-[6px] font-mono font-bold text-indigo-700">
                        {selectedLetterForView.refNumber?.slice(-6) || 'AUTHENTIC'}
                      </div>
                      <div className="text-[5.5px] text-indigo-500 mt-0.5">
                        PULSE HRMS
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Document Security Bar */}
              <div className="mt-12 pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex items-center justify-between">
                <span>
                  Electronically authenticated official document. Cryptographically logged on Vedotrix Pulse HRMS Cloud.
                </span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};