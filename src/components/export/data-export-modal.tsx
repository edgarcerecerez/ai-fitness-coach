
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';

export function DataExportModal() {
  const [format, setFormat] = useState('json');
  const [exportType, setExportType] = useState('full');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/integrations/withings/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format, exportType }),
      });

      if (response.ok) {
        toast({
          title: "Export Initiated",
          description: "You will be notified when your data export is ready.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Export Failed",
          description: errorData.error || 'An unknown error occurred.',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
    setIsExporting(false);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Export Data</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Health Data</DialogTitle>
          <DialogDescription>
            Choose the format and type of data to export.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              Format
            </Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="export-type" className="text-right">
              Export Type
            </Label>
            <Select value={exportType} onValueChange={setExportType}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select an export type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Export</SelectItem>
                <SelectItem value="date_range">Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Initiate Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
