import { Transaction, TransactionType, TaxSetting } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, CartesianGrid } from 'recharts';
import { Download, PieChart as PieIcon, FileText } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface Props {
    transactions: Transaction[];
    taxSettings: TaxSetting[];
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e'];

const Reports: React.FC<Props> = ({ transactions, taxSettings }) => {
    const hasData = transactions.length > 0;

    // Dados para Gráfico de Pizza (Despesas por Categoria)
    const expenseDataMap = transactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
            return acc;
        }, {} as Record<string, number>);

    const pieData = Object.keys(expenseDataMap).map(key => ({
        name: key,
        value: expenseDataMap[key]
    }));

    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const handleDownloadPDF = () => {
        if (!hasData) return;
        const doc = new jsPDF();

        // Configurações de Marca
        const companyName = "FinNexus Enterprise";
        const reportTitle = "Relatório Financeiro Analítico";
        const primaryColor = [79, 70, 229] as [number, number, number]; // Indigo 600

        // Header Colorido
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text(companyName, 14, 20);

        doc.setFontSize(12);
        doc.text("Controle & Auditoria", 14, 28);

        doc.setFontSize(10);
        doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 195, 20, { align: 'right' });
        doc.text(`Solicitado por: Admin`, 195, 28, { align: 'right' });

        // Seção de Resumo Executivo
        const totalIncome = transactions
            .filter(t => t.type === 'RECEITA' && (t.status === 'CONCLUÍDO' || t.status === 'PAGTO PARCIAL'))
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = transactions
            .filter(t => t.type === 'DESPESA' && t.status === 'CONCLUÍDO')
            .reduce((sum, t) => sum + t.amount, 0);

        // Cálculo de impostos
        const totalTaxRate = taxSettings.length > 0
            ? taxSettings.reduce((acc, curr) => acc + (curr.percentage / 100), 0)
            : 0.15;
            
        const totalCommissions = transactions
            .filter(t => t.commissionAmount && (t.status === 'CONCLUÍDO' || t.status === 'PAGTO PARCIAL'))
            .reduce((acc, curr) => {
                // Se for pagamento parcial, a comissão é proporcional ao valor recebido
                if (curr.status === 'PAGTO PARCIAL' && curr.pendingAmount && curr.amount > curr.pendingAmount) {
                    const receivedAmount = curr.amount - curr.pendingAmount;
                    const totalAmount = curr.amount;
                    const proportion = receivedAmount / totalAmount;
                    return acc + ((curr.commissionAmount || 0) * proportion);
                }
                return acc + (curr.commissionAmount || 0);
            }, 0);

        const grossProfit = totalIncome - totalExpense - totalCommissions;
        const estimatedTax = totalIncome * totalTaxRate;
        const netProfit = grossProfit - estimatedTax;

        doc.setTextColor(40, 40, 40);
        doc.setFontSize(14);
        doc.text("Resumo Executivo", 14, 55);

        // Cards de Resumo no PDF
        const startY = 60;

        // Receita
        doc.setFillColor(240, 253, 244); // Green 50
        doc.setDrawColor(22, 163, 74); // Green 600
        doc.roundedRect(14, startY, 45, 25, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74);
        doc.text("Receita Total", 17, startY + 8);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(formatBRL(totalIncome), 17, startY + 18);

        // Despesa (Operacional)
        doc.setFillColor(255, 241, 242); // Rose 50
        doc.setDrawColor(225, 29, 72); // Rose 600
        doc.roundedRect(61, startY, 45, 25, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(225, 29, 72);
        doc.text("Despesa Operac.", 64, startY + 8);
        doc.setFontSize(11);
        doc.text(formatBRL(totalExpense), 64, startY + 18);

        // Comissões
        doc.setFillColor(254, 243, 232); // Orange 50
        doc.setDrawColor(234, 88, 12); // Orange 600
        doc.roundedRect(108, startY, 45, 25, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(234, 88, 12);
        doc.text("Comissões", 111, startY + 8);
        doc.setFontSize(11);
        doc.text(formatBRL(totalCommissions), 111, startY + 18);

        // Resultado Bruto
        doc.setFillColor(238, 242, 255); // Indigo 50
        doc.setDrawColor(79, 70, 229); // Indigo 600
        doc.roundedRect(155, startY, 45, 25, 3, 3, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(79, 70, 229);
        doc.text("Resultado Bruto", 158, startY + 8);
        doc.setFontSize(11);
        doc.text(formatBRL(grossProfit), 158, startY + 18);

        // SEGUNDA LINHA DE CARDS
        const secondRowY = startY + 30;

        // Impostos
        doc.setFillColor(254, 249, 195); // Yellow 50
        doc.setDrawColor(202, 138, 4); // Yellow 600
        doc.roundedRect(14, secondRowY, 92, 25, 3, 3, 'FD');
        doc.setFontSize(10);
        doc.setTextColor(161, 98, 7);
        doc.text(`Impostos Estimados (${(totalTaxRate * 100).toFixed(1)}%)`, 19, secondRowY + 8);
        doc.setFontSize(14);
        doc.text(formatBRL(estimatedTax), 19, secondRowY + 18);

        // Resultado Líquido
        doc.setFillColor(236, 253, 245); // Emerald 50
        doc.setDrawColor(5, 150, 105); // Emerald 600
        doc.roundedRect(111, secondRowY, 85, 25, 3, 3, 'FD');
        doc.setFontSize(10);
        doc.setTextColor(5, 150, 105);
        doc.text("Resultado Líquido (Real)", 116, secondRowY + 8);
        doc.setFontSize(14);
        doc.text(formatBRL(netProfit), 116, secondRowY + 18);

        // Tabela Detalhada
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40);
        doc.setFontSize(14);
        doc.text("Detalhamento de Transações", 14, secondRowY + 40);

        const tableColumn = ["Data", "Descrição", "Categoria", "Valor", "Pendente", "Status", "Funcionário", "Comissão", "Pgto Comis."];
        const tableRows = transactions.map(t => {
            const [year, month, day] = t.date.split('-');
            
            let formattedCommDate = '-';
            if (t.commissionPaymentDate) {
                const [cYear, cMonth, cDay] = t.commissionPaymentDate.split('-');
                formattedCommDate = `${cDay}/${cMonth}/${cYear}`;
            }

            return [
                `${day}/${month}/${year}`,
                t.description,
                t.category,
                formatBRL(t.amount),
                t.pendingAmount ? formatBRL(t.pendingAmount) : 'R$ 0,00',
                t.status,
                t.employeeName || '-',
                t.commissionAmount ? formatBRL(t.commissionAmount) : '-',
                formattedCommDate
            ];
        });

        autoTable(doc, {
            startY: secondRowY + 45,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 6.5, cellPadding: 2 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            columnStyles: {
                3: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'right', textColor: [225, 29, 72] }, // Vermelho para pendente
                7: { halign: 'right' }
            }
        });

        // Rodapé
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount} - FinNexus Enterprise System`, 105, 290, { align: 'center' });
        }

        doc.save(`Relatorio_Financeiro_FinNexus_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    // Cálculo de impostos dinâmico
    const totalIncome = transactions
        .filter(t => t.type === 'RECEITA' && (t.status === 'CONCLUÍDO' || t.status === 'PAGTO PARCIAL'))
        .reduce((s, t) => s + t.amount, 0);
        
    const totalExpense = transactions
        .filter(t => t.type === 'DESPESA' && t.status === 'CONCLUÍDO')
        .reduce((s, t) => s + t.amount, 0);
        
    const totalCommissions = transactions
        .filter(t => t.commissionAmount && (t.status === 'CONCLUÍDO' || t.status === 'PAGTO PARCIAL'))
        .reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

    const grossProfit = totalIncome - totalExpense - totalCommissions;

    // Calcula taxa total
    const totalTaxRate = taxSettings.length > 0
        ? taxSettings.reduce((acc, curr) => acc + (curr.percentage / 100), 0)
        : 0.15;

    const estimatedTax = grossProfit > 0 ? grossProfit * totalTaxRate : 0;
    const netAfterTax = grossProfit - estimatedTax;

    // Dados para gráfico de barras (Receita x Despesa)
    const barData = [
        { name: 'Receita', value: totalIncome, fill: '#10b981' },
        { name: 'Despesa', value: totalExpense, fill: '#f43f5e' },
    ];

    return (
        <div className="space-y-6 w-full animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Relatórios & Auditoria</h2>
                    <p className="text-slate-500 dark:text-slate-400">Emissão de documentos oficiais e análise fiscal.</p>
                </div>
                <button
                    onClick={handleDownloadPDF}
                    disabled={!hasData}
                    className={`flex items-center px-6 py-3 rounded-lg transition-all shadow-lg w-full md:w-auto justify-center font-bold transform hover:scale-105
            ${hasData ? 'bg-indigo-900 text-white hover:bg-indigo-800' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'}`}
                >
                    <FileText className="h-5 w-5 mr-2" />
                    Gerar Relatório PDF Profissional
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Pizza */}
                <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col min-h-[400px]">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Distribuição de Despesas</h3>
                    <div className="flex-1 w-full relative">
                        {hasData && pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke="#fff" />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => [formatBRL(value), 'Valor']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                <div className="p-4 bg-slate-50 rounded-full mb-3">
                                    <PieIcon className="h-6 w-6 text-slate-300" />
                                </div>
                                <p className="text-slate-500 text-sm">Adicione despesas para gerar a análise gráfica.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Auditoria Fiscal */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold mb-2">Auditoria Automática</h3>
                            <p className="text-indigo-200 text-sm mb-6 max-w-sm">O sistema analisa suas transações em tempo real para calcular impostos e prever o fluxo de caixa.</p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                                    <span className="text-xs text-indigo-300 uppercase tracking-wider font-bold">Impostos (Estimado)</span>
                                    <div className="text-2xl font-bold mt-1 text-white">{formatBRL(estimatedTax)}</div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                                    <span className="text-xs text-emerald-300 uppercase tracking-wider font-bold">Líquido Real</span>
                                    <div className="text-2xl font-bold mt-1 text-emerald-400">{formatBRL(netAfterTax)}</div>
                                </div>
                            </div>
                        </div>
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600 rounded-full blur-2xl opacity-20 -ml-10 -mb-10"></div>
                    </div>

                    <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex-1">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Balanço Geral</h3>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={barData} margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <Tooltip cursor={{ fill: 'transparent' }} formatter={(val: number) => formatBRL(val)} contentStyle={{ borderRadius: '8px' }} />
                                    <Bar dataKey="value" barSize={32} radius={[0, 4, 4, 0]} background={{ fill: '#f8fafc' }}>
                                        {barData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;