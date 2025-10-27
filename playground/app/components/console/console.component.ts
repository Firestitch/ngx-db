import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { ConsoleComponent as ConsoleComponent_1 } from '../../../../src/app/components/console/console.component';
import { MatButton } from '@angular/material/button';


@Component({
    templateUrl: './console.component.html',
    styleUrls: ['./console.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatDialogTitle,
        CdkScrollable,
        MatDialogContent,
        ConsoleComponent_1,
        MatDialogActions,
        MatButton,
        MatDialogClose,
    ],
})
export class ConsoleComponent {


}
