'use client';

import { useSendAndConfirmTransaction, useActiveAccount } from 'thirdweb/react';
import type { PreparedTransaction } from 'thirdweb';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { explorerBase } from '@/lib/thirdweb';

type ButtonVariant = React.ComponentProps<typeof Button>['variant'];

interface TxButtonProps {
	prepare: () => PreparedTransaction | Promise<PreparedTransaction>;
	label: string;
	pendingLabel?: string;
	onDone?: () => void;
	disabled?: boolean;
	variant?: ButtonVariant;
	className?: string;
}

export function TxButton({
	prepare,
	label,
	pendingLabel = 'Confirming…',
	onDone,
	disabled,
	variant,
	className,
}: TxButtonProps) {
	const account = useActiveAccount();
	const { mutateAsync, isPending } = useSendAndConfirmTransaction();

	async function run() {
		try {
			const tx = await prepare();
			const receipt = await mutateAsync(tx);
			toast.success('Transaction confirmed', {
				description: `${receipt.transactionHash.slice(0, 12)}…`,
				action: {
					label: 'View',
					onClick: () => window.open(`${explorerBase}/tx/${receipt.transactionHash}`, '_blank'),
				},
			});
			onDone?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			toast.error('Transaction failed', { description: message.slice(0, 160) });
		}
	}

	if (!account) {
		return (
			<Button disabled variant={variant} className={className}>
				Connect wallet
			</Button>
		);
	}

	return (
		<Button onClick={run} disabled={disabled || isPending} variant={variant} className={className}>
			{isPending ? pendingLabel : label}
		</Button>
	);
}
