import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { IndustryType } from '../types';
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Briefcase,
  Image,
  Save,
  X,
  ShieldCheck
} from 'lucide-react';

interface EditOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({
  isOpen,
  onClose
}) => {
  const { currentOrg, updateOrganization, addToast } = useApp();

  const [name, setName] = useState(currentOrg.name);
  const [address, setAddress] = useState(currentOrg.address || '');
  const [phone, setPhone] = useState(currentOrg.phone || '');
  const [website, setWebsite] = useState(currentOrg.website || '');
  const [industry, setIndustry] = useState<IndustryType>(currentOrg.industry || 'Tech');
  const [logoUrl, setLogoUrl] = useState(currentOrg.logoUrl || '/vedotrix-logo.png');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(currentOrg.name);
      setAddress(currentOrg.address || '');
      setPhone(currentOrg.phone || '');
      setWebsite(currentOrg.website || '');
      setIndustry(currentOrg.industry || 'Tech');
      setLogoUrl(currentOrg.logoUrl || '/vedotrix-logo.png');
    }
  }, [isOpen, currentOrg]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Validation Error', 'Organization name is required.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updateOrganization(currentOrg.id, {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        website: website.trim(),
        industry: industry,
        logoUrl: logoUrl.trim() || '/vedotrix-logo.png'
      });
      addToast('Organization Updated 🏢', 'Company details, address, contact and website saved dynamically.', 'success');
      onClose();
    } catch (err) {
      addToast('Save Failed', 'Could not save organization details.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-100 animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Edit Organization Profile</h3>
              <p className="text-[10px] text-slate-500">
                Managed by Superadmin & HR • Dynamic across all components
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Organization Legal Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Organization Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vedotrix Technologies"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Official Address */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1 text-indigo-500" />
              Official Corporate Address
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Cyber City, HITEC City, Hyderabad, Telangana 500081, India"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Reflected on Offer Letters, Payslips, Attendance Cards, and Verification Receipts.
            </span>
          </div>

          {/* Contact Phone & Official Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center">
                <Phone className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                Contact Phone / Helpline
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 80 4400 9900"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center">
                <Globe className="w-3.5 h-3.5 mr-1 text-blue-500" />
                Official Website URL
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://vedotrix.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Industry & Logo URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center">
                <Briefcase className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Industry Sector
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value as IndustryType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Tech">Tech / Information Technology</option>
                <option value="Digital Marketing">Digital Marketing & Media</option>
                <option value="Hybrid">Hybrid Services & Operations</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center">
                <Image className="w-3.5 h-3.5 mr-1 text-purple-500" />
                Logo URL
              </label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="/vedotrix-logo.png"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Live Preview of Organization Stamp */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src={logoUrl || '/vedotrix-logo.png'}
                alt={name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/vedotrix-logo.png';
                }}
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate">{name}</span>
              <p className="text-[10px] text-slate-500 truncate">{address || 'No address set'} • {phone || 'No phone set'}</p>
              <a href={website} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-semibold truncate block">
                {website || 'No website set'}
              </a>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold transition flex items-center space-x-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Organization Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
