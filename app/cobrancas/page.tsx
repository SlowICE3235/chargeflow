"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Charge, Customer, ChargeStatus } from "@/types";
import { Plus, Upload, CheckCircle } from "lucide-react";

export default function CobrancasPage() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState<"ALL" | ChargeStatus>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [notes, setNotes] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: chargesData } = await supabase
      .from("charges")
      .select("*, customers(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data: customersData } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id);

    if (chargesData) setCharges(chargesData);
    if (customersData) setCustomers(customersData);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("charges").insert({
      user_id: user.id,
      customer_id: customerId,
      amount: parseFloat(amount),
      due_date: dueDate,
      status: "PENDING",
      is_recurrent: isRecurrent,
      payment_link_or_pix: paymentLink || null,
      notes: notes || null,
    });

    if (!error) {
      resetForm();
      setDialogOpen(false);
      loadData();
    }
  };

  const resetForm = () => {
    setCustomerId("");
    setAmount("");
    setDueDate("");
    setIsRecurrent(false);
    setPaymentLink("");
    setNotes("");
  };

  const markAsPaid = async (chargeId: string) => {
    await supabase.from("charges").update({ status: "PAID" }).eq("id", chargeId);
    loadData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const Papa = await import("papaparse");
    Papa.default.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        for (const row of results.data as any[]) {
          const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id")
            .eq("user_id", user.id)
            .eq("phone", row.Telefone)
            .single();

          let customerId = existingCustomer?.id;

          if (!customerId) {
            const { data: newCustomer } = await supabase
              .from("customers")
              .insert({ user_id: user.id, name: row.Nome, phone: row.Telefone })
              .select()
              .single();
            customerId = newCustomer?.id;
          }

          if (customerId) {
            await supabase.from("charges").insert({
              user_id: user.id,
              customer_id: customerId,
              amount: parseFloat(row.Valor),
              due_date: row.Vencimento,
              status: "PENDING",
              payment_link_or_pix: row.LinkPagamento || null,
            });
          }
        }
        loadData();
      },
    });
  };

  const filteredCharges = filter === "ALL" ? charges : charges.filter((c) => c.status === filter);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const statusConfig = {
    PENDING: { label: "Pendente", variant: "secondary" as const },
    PAID: { label: "Pago", variant: "default" as const },
    OVERDUE: { label: "Atrasado", variant: "destructive" as const },
    CANCELLED: { label: "Cancelado", variant: "outline" as const },
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cobranças</h1>
            <p className="text-muted-foreground">Gerencie suas cobranças e acompanhe pagamentos</p>
          </div>
          <div className="flex gap-2">
            <input type="file" accept=".csv,.xlsx" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Importar CSV
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Cobrança
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Cobrança</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor (R$)</Label>
                    <Input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Data de Vencimento</Label>
                    <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentLink">Link de Pagamento / PIX</Label>
                    <Input id="paymentLink" placeholder="https://..." value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full">Salvar Cobrança</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="ALL">Todos</TabsTrigger>
            <TabsTrigger value="PENDING">Pendentes</TabsTrigger>
            <TabsTrigger value="PAID">Pagos</TabsTrigger>
            <TabsTrigger value="OVERDUE">Atrasados</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCharges.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell className="font-medium">{charge.customers?.name || "Cliente"}</TableCell>
                  <TableCell>{formatCurrency(charge.amount)}</TableCell>
                  <TableCell>{new Date(charge.due_date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[charge.status].variant}>{statusConfig[charge.status].label}</Badge>
                  </TableCell>
                  <TableCell>
                    {charge.status === "PENDING" && (
                      <Button size="sm" variant="outline" onClick={() => markAsPaid(charge.id)}>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Marcar Pago
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredCharges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma cobrança encontrada</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Shell>
  );
}
