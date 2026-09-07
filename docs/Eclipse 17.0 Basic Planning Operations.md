# test01.pdf (OCR / embedded-text extraction)


<!-- page 1 -->

varian

Skills Circle

### Eclipse 17.0 Basic Planning Operations

EDT002

EC17.0-PCD-01-A

## 1

<!-- page 2 -->

varian

Eclipse 17.0 Basic Planning

## Abstract

This Eclipse 17.0 Basic Planning is an educational aid for Varian treatment planning software.

## Notice

Information within this document is subject to change without notice and does not represent a commitment on the part of Varian. Varian is not liable for errors contained in this document or for incidental or consequential damages in connection with furnishing or use of this material. This document contains proprietary information protected by copyright. No part of this document may be reproduced, translated, or transmitted without the express written permission of Varian Medical Systems, Inc.

## HIPAA

Varian's products and services are specifically designed to include features that help our customers comply with the Health Insurance Portability and Accountability Act of 1996 (HIPAA). The ARIA and VARIS Vision systems use a secure login process, requiring a user name and password that supports role-based access. Users are assigned to groups, each with certain access rights, which may include the ability to edit and add data or may limit access to data. When a user adds or modifies data within the database, a record is maintained of the data that was changed, the users ID and the date and time the changes were made. This establishes an audit trail that can be examined by authorized system administrators.

## Trademarks

Eclipse™ Treatment Planning System, Millennium™ MLC and 4D Integrated Treatment Console™ are trademarks of Varian Medical Systems, Inc.

Eclipse™ treatment planning system of Varian Medical Systems, Inc.

ARIA® oncology information system, Clinac®, Halcyon®, RapidArc®, TrueBeam®, Edge®, Clinac® iX linear accelerators, Calypso® system, Acuros®, RapidPlan®, HyperArc®, Smart Segmentation® automatic contouring utility, Dynamic Targeting® IGRT technology, Exact® couch, Exact® IGRT couch, On-Board Imager® kV imaging system, Enhanced Dynamic Wedge™, are registered trademarks of Varian Medical Systems, Inc.

All other trademarks or registered trademarks are the property of their respective owners.

© 2020 Varian Medical Systems, Inc.

All rights reserved.

DC-DOC-16-C

1

EC17.0-PCD-01-A

Varian Confidential

<!-- page 3 -->

varian

Eclipse 17.0 Basic Planning

## Eclipse Fair Balance Safety Statement

## Intended Use Summary

The Eclipse Treatment Planning System (Eclipse TPS) is used to plan radiotherapy treatments for patients with malignant or benign diseases. Eclipse TPS is used to plan external beam irradiation with photon, electron and proton beams, as well as for internal irradiation (brachytherapy) treatments. In addition, the Eclipse Proton Eye algorithm is specifically indicated for planning proton treatment of neoplasms of the eye.

## Important Safety Information

Radiation treatments may cause side effects that can vary depending on the part of the body being treated. The most frequent ones are typically temporary and may include, but are not limited to, irritation to the respiratory, digestive, urinary or reproductive systems, fatigue, nausea, skin irritation, and hair loss. In some patients, they can be severe. Treatment sessions may vary in complexity and time. Radiation treatment is not appropriate for all cancers. You should discuss the potential for side effects and their severity as well as the benefits of radiation with your doctor to make sure radiation treatment is right for you.

## Medical Advice Disclaimer

Varian as a medical device manufacturer cannot and does not recommend specific treatment approaches. Individual treatment results may vary.

DC-DOC-16-C

Varian Confidential

2

EC17.0-PCD-01-A

<!-- page 4 -->

varian

Eclipse 17.0 Basic Planning

## Contacting Support

Support services are available without charge during the initial warranty period.

Contact Varian Medical Systems for any of these reasons:

* You need information not included in this publication.

* You need to order additional documents.

* You need to obtain support by e-mail.

Find the most up-to-date contact information at MyVarian.com.

## Online Resources

If you have access to the Internet, you can find various help resources here:

Varian.com | Oncology Systems: https://www.varian.com/oncology/service-education

DC-DOC-11-C

Varian Confidential

3

EC17.0-PCD-01-A

<!-- page 5 -->

varian

Eclipse 17.0 Basic Planning

## Contents

Contacting Support ..... 3  
Online Resources ..... 3  
Navigating Eclipse ..... 9  
Section 1: Eclipse Overview ..... 9  
Section 2: Login UserHome ..... 10  
Enhanced Security ..... 10  
Section 3: UserHome ..... 16  
Section 4: QuickLinks ..... 18  
Section 5: Search for a Patient ..... 28  
Section 6: Object Explorer Information ..... 31  
Section 7: Display ..... 42  
Section 8: Opening a Second Instance in Eclipse ..... 45  
Section 9: Switch User, Close All and UserHome Options ..... 54  
Section 10: Help ..... 57  
DICOM Import ..... 59  
Section 1: DICOM Import ..... 59  
References ..... 59  
Section 2: Import a Patient Using DICOM Import Export ..... 60  
General Information ..... 60  
Eclipse Contouring ..... 74  
Section 1: Eclipse Contouring Overview ..... 74  
References ..... 74  
Section 2: Setting User Origin in Contouring Application ..... 75  
Section 3: Changing the Graphics View ..... 81  
Section 4: Options ..... 82  
Section 5: Add Structures ..... 86  
Structures Overview ..... 86  
Section 6: Drawing Toolbox ..... 98  
Planar Drawing Tool ..... 101

DC-DOC-11-C

4

EC17.0-PCD-01-A

Varian Confidential

<!-- page 6 -->

varian

Eclipse 17.0 Basic Planning

Brush Tool ..... 111  
Segmentation Wizard ..... 117  
Post Processing Tools ..... 124  
Flood Fill ..... 142  
Crop Structure Tool ..... 147  
Boolean Operators ..... 151  
Expand CTV into PTV ..... 156  
Extract Wall Tool ..... 161  
Manually Contour Body Structure ..... 165  
Section 7: Approve Structure ..... 169  
Contouring High-Density Artifacts for Acuros®XB ..... 172  
Section 1: High-Density Artifacts Overview ..... 172  
Objectives ..... 172  
References ..... 172  
Section 2: General Information ..... 173  
Section 3: Contouring with High Density Artifacts Tool ..... 175  
External Beam Planning ..... 183  
Section 1: External Beam Planning Overview ..... 183  
References: ..... 183  
Section 2: Navigate to External Beam Planning Application ..... 184  
Section 3: Adding Couch Structures to the Data Set ..... 186  
Section 4: Create a New Plan ..... 192  
Adjusting field parameters manually ..... 210  
Insert a Digitally Reconstructed Radiograph (DRR) ..... 215  
Edit DRR ..... 219  
Add an MLC to Field ..... 232  
Add an Opposing Field ..... 243  
Add a Wedge to Field 1-RAO ..... 247  
Add a Bolus to Field 1-RAO ..... 250  
Section 5: Setup Fields ..... 257  
Section 6: AAA Dose Calculation and Field Normalization Options ..... 269  
Section 7: Acuros XB Dose Calculation and Field Normalization ..... 291  
Section 8: Reference Points and Dose Prescription Volumes ..... 308  
General Information ..... 308

DC-DOC-11-C

5

EC17.0-PCD-01-A

Varian Confidential

<!-- page 7 -->

varian

Eclipse 17.0 Basic Planning

A Reference Point has a physical location ..... 308  
Section 9: Plan Approval and Delta Couch Shift ..... 320  
General Information ..... 320  
Section 10: Create Templates ..... 331  
General Information ..... 331  
Section 11: Revisions to Plans ..... 350  
General Information ..... 350  
Section 12: Field Alignment ..... 360  
Field Alignment Concepts ..... 360  
Preliminary Steps: ..... 361  
Define the Field Alignment rules: ..... 362  
Modify a Field Alignment rule: ..... 371  
Delete Field Alignment rule: ..... 371  
Section 13: Create 2 Separate Plans from the Combined Plan ..... 372  
Section 14: Field in Field ..... 375  
To create a Field in Field plan for this patient: ..... 377  
Section 15: Electron Plans ..... 394  
Section 16: Plan Sums ..... 414  
General Information ..... 414  
Review the doses to each Reference Point ..... 418  
Review the Dose Distribution ..... 419  
To create a plan sum prior to planning: ..... 421  
Bookmarks and RT Peer Review ..... 433  
Section 1: Bookmarks and RT Peer Review Overview ..... 433  
User Rights for RT Peer Review ..... 434  
Section 2: Create Bookmarks for Physician Review ..... 438  
Section 3: Use Bookmark Manager to Review Plans ..... 442  
Section 4: Bookmarks in Plan Evaluation ..... 449  
Section 5: Working in RT Peer Review ..... 454  
Preparing a Review Session ..... 455  
Activate a Review Session ..... 457  
The Review Session History Tab ..... 461  
Plan Evaluation ..... 463  
Section 1: Plan Evaluation Overview ..... 463

DC-DOC-11-C

6

EC17.0-PCD-01-A

Varian Confidential

<!-- page 8 -->

varian

Eclipse 17.0 Basic Planning

References: ..... 463  
Section 2: Isodose Levels ..... 464  
Section 3: Scale Doses ..... 477  
Section 4: Change Isodose Levels in Graphics View ..... 480  
Section 5: Isodose Color Wash and Dose Color Wash ..... 482  
Section 6: Move Viewing Planes to Global Maximum Dose ..... 485  
Section 7: Point Dose Tool ..... 488  
Section 8: Default Options for Dose Display Setting ..... 490  
Section 9: Dose Volume Histograms (DVH) ..... 503  
Section 10: DVH Toolbar Options ..... 515  
Section 11: DVH Other Options ..... 523  
Section 12: Plan Comparison DVH ..... 527  
Section 13: DVH Printing ..... 539  
Image Registration ..... 543  
Section 1: Image Registration Overview ..... 543  
References: ..... 543  
Introduction ..... 543  
Overview ..... 543  
Rigid Registrations Methods: ..... 544  
Section 2: Navigate to Image Registration ..... 545  
Section 3: Create a New Rigid Registration using Auto Match ..... 553  
Section 4: Evaluating a Registration Match ..... 561  
Section 5: Create a Rigid Registration using Manual Match ..... 581  
Section 6: Other Registration Options ..... 586  
Section 7: Set System Preferences ..... 592  
Section 8: Contour on a Registered Image ..... 601  
Section 9: CT-PET Contouring ..... 608  
Appendix ..... 627  
Section 1: Eclipse Icon Table ..... 627  
Section 2: Keyboard Shortcuts ..... 631  
Section 3: Workspace Icons ..... 634  
RT Summary--Timeline Icons ..... 634  
RT Summary--Session Icons ..... 635  
Plan Scheduling Icons ..... 635

DC-DOC-11-C

7

EC17.0-PCD-01-A

Varian Confidential

<!-- page 9 -->

varian

Eclipse 17.0 Basic Planning

DC-DOC-11-C

Varian Confidential

8

EC17.0-PCD-01-A

<!-- page 10 -->

varian

Eclipse 17.0 Basic Planning

# Navigating Eclipse

## Section 1: Eclipse Overview

Eclipse is designed for 3D image viewing, definition of tumor and other anatomical structures, field setup, virtual simulation, dose calculation and plan evaluation.

Eclipse is divided into different applications; each specific application has a specific purpose at different phases of treatment planning.

Some of the applications used in the treatment planning process in Eclipse and ARIA are:

DICOM Import Export is meant for importing and exporting images.

* Selection application is meant for creating patient 3D images

* Contouring is meant for defining patient volumes

* Image Registration is available in the Registration application and allows Eclipse to spatially align image data sets, such as CT and MR images.

* External Beam Planning application provides tools for treatment planning

* Plan Evaluation application provides tools for plan comparison and evaluation of the completed plans.

When working in Eclipse, users can perform the following tasks:

* Start Eclipse applications

* Navigate Eclipse using QuickLinks

* Start New Eclipse Sessions

* Set a default startup application

* Switch system users

DC-DOC-11-C

Varian Confidential

9

EC17.0-PCD-01-A

<!-- page 11 -->

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential


<think>

</think>

varian

Eclipse 17.0 Basic Planning

## Section 2: Login UserHome

## Enhanced Security

Version 15 introduced improved the data security and access permissions in different hospital environments. It protects patient data and allows a defined application environment for Varian software.

All versions after 15 use a new approach to user and application access control, based on a new security implementation. The customer, as owner of the local IT environment, shall be responsible to supply and configure an appropriate Windows Domain environment suitable to host the ARIA Oncology Information System.

The implications of this to the end user, is that you will access all ARIA/Eclipse applications with your Windows username and password.

1) You will login into Windows using Connie Walker (cwalker).

<img src="images/bbox_104_414_901_773.jpg" />

cwalker

Other user

DC-DOC-11-C

10

EC17.0-PCD-01-A

Varian Confidential

<!-- page 12 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
11
EC17.0-PCD-01-A
Varian Confidential
Note: You may wish to choose to use a different login than the one that is defaulted. If you
wish to use a different login, click Other user in bottom left of screen.


When the Other User window opens, you would type another user in Username and Password cells.

<!-- page 13 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
12
EC17.0-PCD-01-A
Varian Confidential
2) A password is needed.
a) Type ‘cwalker’ for Password.
b) Click right-facing arrow to continue.



a
b

<!-- page 14 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
13
EC17.0-PCD-01-A
Varian Confidential
3) UserHome screen opens.
a) Login to UserHome by double clicking the UserHome icon.




a

<!-- page 15 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
14
EC17.0-PCD-01-A
Varian Confidential
4) The Varian Login dialog box opens if Windows Integrated Authentication is unchecked in Varian
Service Portal (VSP.)
a) Type Windows User Name. For this example, cwalker.
b) Type Windows Password. For this example, cwalker.
c) Click Login.
Note: The Varian Login dialog box will not open if the Windows Integrated Authentication
has been checked in VSP.
Please see Varian Service Portal Administration Reference Guide—P1014877-005-E for
more information on the VSP







a
c
b

<!-- page 16 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
15
EC17.0-PCD-01-A
Varian Confidential
d) UserHome opens.





d

<!-- page 17 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
16
EC17.0-PCD-01-A
Varian Confidential
Section 3: UserHome
1) Login to UserHome following steps above.
2) ARIA/Eclipse UserHome allows you to launch tasks and / or appointments assigned to you to
assist you in performing your job. The tasks and appointments may be associated to patients but
do not contain patient details. This allows for a comprehensive workflow. You can:
a) View, access and complete tasks and appointments from the Tasks and Appointments tab.
b) View and access appointment schedules from the Schedule tab.
c) Access commonly used workspaces from Favorites tab.
d) View and access patient information from the Patient List tab.

Note: You learn more about workflow management during your ARIA training.

a
b
d
c

<!-- page 18 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
17
EC17.0-PCD-01-A
Varian Confidential
3) Assistant is the menu bar in the UserHome screen that helps you manage your workflow.
Assistant appears at the top of the screen.
a) Assistant.





a

<!-- page 19 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
18
EC17.0-PCD-01-A
Varian Confidential
Section 4: QuickLinks
1) QuickLinks provides easy navigation from one application to another.

2) To view the QuickLinks options, click the QuickLinks drop down.  The QuickLinks menu
organizes the applications into groups as follows:
a) Favorites – This section displays menu items for your favorite applications. You configure
these the Customize section
b) Categories – This section displays the categories within the database
c) Customize – This section allows you to customize what displays when you click the
QuickLinks drop down arrow

b
1
c
a

<!-- page 20 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
19
EC17.0-PCD-01-A
Varian Confidential
3) To customize the Favorites section of your QuickLinks display:
a) Select Customize…



a

<!-- page 21 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
20
EC17.0-PCD-01-A
Varian Confidential
b) The Customize QuickLinks Favorites dialog box opens.
c) From the Category section, select a category. For this example, select Treatment Planning.
d) From the Activities section, highlight an activity. For this example, select External Beam
Planning.
e) Click the right arrow to move the activity to the QuickLinks Favorites section. For this
example, select External Beam Planning, Selection, Contouring, and Plan Evaluation.
f)
Click Done to save your changes.



b
e
c
d
f

<!-- page 22 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
21
EC17.0-PCD-01-A
Varian Confidential
g) Select QuickLinks.
h) External Beam Planning, Selection, Contouring and Plan Evaluation now appear in your
Favorites.




h
g

<!-- page 23 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
22
EC17.0-PCD-01-A
Varian Confidential
4) You can set a default workspace for the logged-in user. After setting the default workspace when
the logged-in user selects a patient to open, the patient will open in the default workspace.
a) To customize the default application, select Customize…



a

<!-- page 24 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
23
EC17.0-PCD-01-A
Varian Confidential
b) Select the Category. For this example, select Treatment Planning.
c) Select the Activities. For this example, select External Beam Planning.
d) Select the right arrow icon to move the activity item into the Default Workspace.
e) Click Done to save your entry and close the dialog box.



b
c
d
e

<!-- page 25 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
24
EC17.0-PCD-01-A
Varian Confidential
5) By default, the system includes all the available applications in the QuickLinks menu.

Note: You may want to limit the list to only the workspaces that you use to make your
workflow more efficient.








5

<!-- page 26 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
25
EC17.0-PCD-01-A
Varian Confidential
6) To limit the list for the logged in user:
a) Click the QuickLinks drop down;
b) Select Customize…



a
b

<!-- page 27 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
26
EC17.0-PCD-01-A
Varian Confidential
c) In the Category section, select Category. For this example, select Imaging.
d) In the Activities section, un-check the activity. For this example, select Portal Dosimetry.
e) Click Done.



c
d
e

<!-- page 28 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
27
EC17.0-PCD-01-A
Varian Confidential
f)
The system removes the item you un-checked from the Imaging choices.  For this example,
Portal Dosimetry.



f

<!-- page 29 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
28
EC17.0-PCD-01-A
Varian Confidential
Section 5: Search for a Patient
You can search for a patient using several options.
You can open multiple instances of Eclipse to allow you to work on several patients at one time. This is
useful if you have several patients to plan that are at different stages of the planning process. For
example, you are creating a plan for a patient; the doctor needs to contour the GTV on another patient;
the doctor needs to approve another patient plan. You can have the plan you are working on open and
have the others available for when the doctor arrives so that the patients are easily accessed.
The Search Patient icon
 allows
you to search for a patient.

1) To search for a patient:
a) Click the Search Patient icon.
b) A list of up to the last 6 recently searched patients (for the logged-in user) appears in the
drop-down list.


2) Alternate patient search:
a) In the data field, begin typing a portion of the patient’s first name, last name or ID1 (the
system will dynamically search for all patients meeting the criteria you type).
b) From the list, select a patient. For this example, do not select a patient.
c) You can search for a patient using other attributes in the advanced search option. Select
Advanced Search.




c
a
b
a
b

<!-- page 30 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
29
EC17.0-PCD-01-A
Varian Confidential
d) The Patient Explorer dialog box opens.
e) You can search by Patient Last Name, First name, SSN, Birth Date, or ID.
f)
You can search by Course/Tx Status, Oncologist, etc. by selecting the Advanced drop-
down arrow
g) You can search by Plan and treatment status by selecting Plan and treatment status drop
down arrow.






d
e
f
g

<!-- page 31 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
30
EC17.0-PCD-01-A
Varian Confidential
h) For this example, In the ID I field, type US-EC.
i)
Click Search.
j)
From the list, select US-EC-020.
k) Click OK to open the Object Explorer dialog box.



j
i
k
h

<!-- page 32 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
31
EC17.0-PCD-01-A
Varian Confidential
Section 6: Object Explorer Information
1) The Object Explorer dialog box opens with the patient’s name and ID in its header in the
Default Workspace (in our example, External Beam Planning.)
2) In the Context window, the patient’s ID is displayed with the objects and/or folders attached to the
patient.




Note: The Object Explorer will open from anywhere within Eclipse when you select Open
Objects icon and have a patient open in the system. If no patient is open, then Patient
Explorer will open before Object Explorer.







1
2

<!-- page 33 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
32
EC17.0-PCD-01-A
Varian Confidential
Note: The information displays according to where the patient is in the planning process.
For example, if you have just imported the patient’s CT planning images you may not see a
course listed; the All Structure Sets folder may be empty due to the fact no structure sets
have been added for the patient.

<!-- page 34 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
33
EC17.0-PCD-01-A
Varian Confidential
3) When you select an object from the left-hand panel, the right-hand panel displays details of the
contents within that folder.
a) To view plans within a course, select the course folder. For this example, click the course
labeled C1.




a

<!-- page 35 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
34
EC17.0-PCD-01-A
Varian Confidential
b) The plan(s) attached to the course, displays in the right-hand panel. To open the plan, select
the plan from the right-hand panel. For this example, select 8FIMRT SW.


Note: If the course has multiple plans, you can use control + click to display the plans you
wish to view. If you want to display all the plans within a course, select the course from the
left-hand panel and click OK. This will display all plans within a course.

c) Click OK.



b
c

<!-- page 36 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
35
EC17.0-PCD-01-A
Varian Confidential
d) The information displays in the External Beam Planning application.

Note: You can navigate to the other applications to work on the plan, if needed.

e) To return to Object Explorer, select the Open Objects
 icon.




d
e

<!-- page 37 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
36
EC17.0-PCD-01-A
Varian Confidential
4) The All Diagnostic Images folder contains all the 3D images as well as the individual series of
images.
a) Click the All Diagnostic Images folder to expand the information in the folder.
b) To display the 3D images, select the Series: Series.
c) To open the 3D Image in Eclipse, from the list in the right-hand panel, select CT_1.
d) Click OK.




a
b
c
d

<!-- page 38 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
37
EC17.0-PCD-01-A
Varian Confidential
e) The 3D image displays in the External Beam Planning application.


Note: You can navigate to the other applications to work on the plan, if needed.

f)
To return to Object Explorer, select the Open Objects
 icon.






e
f

<!-- page 39 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
38
EC17.0-PCD-01-A
Varian Confidential
5) The All Structure Sets folder contains all the structure sets associated with the patient’s plans.
a) Select the All Structure Sets folder.
b) The 2 structure sets belonging to this patient displays in the right-hand panel.  Select the
structure set you want to display, for this example, select EC OPS.
c) Click OK.




a
b
c

<!-- page 40 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
39
EC17.0-PCD-01-A
Varian Confidential
d) The structure set you selected displays all the structures associated with the structure set.
e) To return to Object Explorer, select the Open Objects
 icon.





d
e

<!-- page 41 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
40
EC17.0-PCD-01-A
Varian Confidential
6) The DICOM View displays all objects that are DICOM.
a) To view the DICOM objects, select the DICOM View folder.
b) Click OK.



a
b

<!-- page 42 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
41
EC17.0-PCD-01-A
Varian Confidential
c) The patient you selected opens with all the DICOM information. For this patient, there are
several courses, plans, images. Using DICOM may be confusing.





c

<!-- page 43 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
42
EC17.0-PCD-01-A
Varian Confidential
Section 7:  Display
1) The display GUI (graphical user interface) is divided into the following sections:
a) Title Bar
b) Assistant
c) Menu Bar





a
b
c

<!-- page 44 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
43
EC17.0-PCD-01-A
Varian Confidential
d) Toolbar
e) Workspace Bar
f)
Graphics View



e
d
f

<!-- page 45 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
44
EC17.0-PCD-01-A
Varian Confidential
g) Context window
h) Upper portion of Context window is Scope
i)
Lower portion of Context window is Focus
j)
Information (Info) window



h
i
g
j

<!-- page 46 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
45
EC17.0-PCD-01-A
Varian Confidential
Section 8: Opening a Second Instance in Eclipse
If you already have a patient open in Eclipse you can open a second instance (for another patient). You
may want to open a second instance of Eclipse for easier access when the physician is ready to work with
you. This will allow more efficient access to the patients.

Note: You have a limit of 10 instances you can have opened at any one time. However, be
aware that if you have several instances open at one time, it could affect the performance of
Eclipse. It is not recommended to open the same patient in multiple instances to avoid
concurrent editing.
1) To open a second instance of Eclipse:
a) In the Search Patient field begin to type a patient name. For this example, begin typing RA.
b) From the list, select the arrow to the right of the patient’s name. For this example, select RA
OPS, LUNG PT.
c) To the right of the desired application, click to open in new window arrow.  For this example,
select the arrow to the right of External Beam Planning.



a
b
c

<!-- page 47 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
46
EC17.0-PCD-01-A
Varian Confidential
d) The Object Explorer dialog box opens.
e) Click OK.




d
e

<!-- page 48 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
47
EC17.0-PCD-01-A
Varian Confidential
f)
A second instance of Eclipse opens.



f

<!-- page 49 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
48
EC17.0-PCD-01-A
Varian Confidential
g) For optional viewing of multiple patients, you have opened, right click in the Taskbar.
h) Select Taskbar settings.



h
g

<!-- page 50 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
49
EC17.0-PCD-01-A
Varian Confidential
i)
The Settings dialog box opens.
j)
Use the scroll bar on the right to locate Taskbar information





i
j

<!-- page 51 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
50
EC17.0-PCD-01-A
Varian Confidential
k) Select Never under the “Combine taskbar buttons” dropdown.
l)
Click “X” in upper right corner to close dialog box.



k
l

<!-- page 52 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
51
EC17.0-PCD-01-A
Varian Confidential
m) The system separates the icons and displays the individual patients for easy viewing.



m

<!-- page 53 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
52
EC17.0-PCD-01-A
Varian Confidential
2) If you wish to open the selected patient in a different application, you may click that application on
the Workspace Bar.

OR:
a) Click in the Assistant in the Search Patient space.
b) Hover over the drop-down icon to the right of the patient’s name.
c) The QuickLinks list displays. Click the desired application. For this example, select
Contouring.



a
b
c
2

<!-- page 54 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
53
EC17.0-PCD-01-A
Varian Confidential
d) The patient opens in the Contouring workspace.





d

<!-- page 55 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
54
EC17.0-PCD-01-A
Varian Confidential
Section 9:  Switch User, Close All and UserHome Options
1) The drop-down next to the logged-in user’s name allows you to:
a) Switch User;
b) Lock (the workstation);
c) Close All;
d) Configure UserHome Options.

 Users can log on to the same session that another staff member has opened. This action
supports such activities as physician plan approval.
 When switching users without closing the current ARIA session, ARIA automatically logs the
previous user off the system.
2) To switch user:
a) Click the drop-down arrow next to the logged-in user’s name.



a
b
c
a
d

<!-- page 56 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
55
EC17.0-PCD-01-A
Varian Confidential
b) From the drop-down menu, select Switch User.

Note: This feature is not available in applications that affect patient treatment delivery,
which helps ensure that inadvertent changes to dose or other details do not occur.


c) The Switch User dialog box opens.
d) Enter User Name and Password.  For this example, type asmith in the User ID field and
asmith in the Password field.
e) Click OK—asmith’s User Home will open again.




b
c
d
e

<!-- page 57 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
56
EC17.0-PCD-01-A
Varian Confidential

Note: If there is any un-saved data on any of the opened instances, the following warning
will appear and you will need to Save, Discard or Cancel the switch user option.




3) The system may also be Locked. Another user attempts to log in when the system is locked, a
warning message displays saying that unsaved information may be lost. The system will open to
the new user’s home screen. Do not Lock the system as the vCloud may experience
problems.
a) At the end of the day, you will log-off the system. To Log Off, click the drop-down next to the
logged-in user’s name.
b) Do not use ‘Close All’ now.




a

<!-- page 58 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
57
EC17.0-PCD-01-A
Varian Confidential
Section 10: Help
The Help menu allows you to:
 Select several online help menus;
 View information about your system through “About”.
1) Using the QuickLinks, navigate to External Beam Planning.
2) To access online help:
a) Click the Help icon;
b) From the list select, click RT and Imaging Online Help Contents.



b
a

<!-- page 59 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
58
EC17.0-PCD-01-A
Varian Confidential
c) The RT and Imaging Online Help dialog box opens.
d) Select the Search tab.
e) Search an item.





d
e
c

<!-- page 60 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
59
EC17.0-PCD-01-A
Varian Confidential
DICOM Import
Section 1: DICOM Import
References
1) Eclipse Photon and Electron Instructions for Use. P1047678-002-B
2) DICOM Import and Export Reference Guide P1034778-002-B


Eclipse must have a 3D CT image for treatment planning.
The DICOM application allows you to do the following:
 Import patient images
 Create 3D and 4D images
 Set User Origin
 Navigate Object Explorer

<!-- page 61 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
60
EC17.0-PCD-01-A
Varian Confidential
Section 2: Import a Patient Using DICOM Import Export
General Information
The DICOM Import and Export application is designed to import and export objects of a patient.
The DICOM Import and Export application provides comprehensive, scalable and easy-to-use DICOM
functionality through all of Varian’s product lines. It provides import and export of non-DICOM image
formats, like JPEG, TIFF, and BMP. It supports image acquisition/import through external devices by
scanning or frame grabbing.
You can use DICOM Import and Export application to:
 Import images from external DICOM devices such as CT, PET, or MRI scanners.
 Export plans and reference images as well as importing treatment records in DICOM RT mode.
For further information, refer to DICOM RT Mode Reference Guide.
 Connecting to another Varian System or, 3rd-party PACS using Network filters:
 DICOM Query/Retrieve (importing image data by connecting for instance to a Varian DB
service).
 DICOM Storage (exporting image data by connecting for instance to a PACS).
 The Gantry angle of the CT scanner must be set to 0 degrees.
 Scans with unequal slice thickness and separation can be imported into Eclipse, but the 3D
image must be created with slices of uniform thickness and spacing. Eclipse will select a default
slice separation. This value can be modified by the user.

<!-- page 62 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
61
EC17.0-PCD-01-A
Varian Confidential
Caution: Always verify the imaging interface (CT, MR, etc.) for each imaging device for
correctness. Check the images for correct image pixel size scaling, mirroring, and image
rotation. Check and calibrate the imaging devices before using them. Periodically check the
calibration by imaging and plotting test phantoms. Use correct scaling for the secondary
imaging devices that are used to create image files to be imported to the system (from
Eclipse Photon and Electron Instructions for Use. P1047678-002-B, page 43.)


Note: Make sure that the CT scanner is correctly configured (for instructions, refer to online
help or Beam Configuration Reference Guide.) The images must be CT images with a valid
mapping from pixel values to HU values. Normally, this mapping is correct in DICOM
images. If you use images of some other modality than CT, define the Body structure and
assign a CT value for it to indicate the HU values for dose calculation. (from Eclipse Photon
and Electron Instructions for Use. P1047678-002-B. “Image Requirements for Correct Dose
Calculations”, page 264.)


Note: Each Import Filter and each Export Filter must be individually configured.

<!-- page 63 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
62
EC17.0-PCD-01-A
Varian Confidential
1) We will use DICOM Import Export Application to import a patient.
a) Click the QuickLinks menu.
b) Select DICOM.
c) Click Import Export.



a
b
c

<!-- page 64 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
63
EC17.0-PCD-01-A
Varian Confidential
2) The DICOM Import Export Application opens.


a) Click the DICOM Media File Import Filter-DICOM media File Import Filter.


b) Click Filter Selection button.





a
b

<!-- page 65 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
64
EC17.0-PCD-01-A
Varian Confidential
c) The system reads the summary of DICOM objects waiting to be imported.


c

<!-- page 66 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
65
EC17.0-PCD-01-A
Varian Confidential
d) The patients that are available for import are listed on the left side of Import Export screen.
e) Selecting the Scan subdirectories check box will allow the system to check for any
additional DICOM imaging data sets that may be ready for import.
f)
Select the Ellipsis to search for the appropriate Import directory.

g) Select Network>Server>DICOM>Import.
h) Click OK.
Note: Change directories by selecting
 and choosing the appropriate directory.


g
e
f
h
d

<!-- page 67 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
66
EC17.0-PCD-01-A
Varian Confidential
i)
For this example, select patient US-EC-2222 – ECOPS, LUNG PT.

j)
Import Selection opens displaying US-EC-2222 with the objects attached; in this example
CT #1 HFS (Chest).
k) Click
 button to begin patient import.








j
k
i

<!-- page 68 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
67
EC17.0-PCD-01-A
Varian Confidential
l)
Patient Selection opens, reading the patient data.

m) From the Patient Selection pane, you can select an existing patient, create a new one or
browse for patients.
n) We have a matching patient. Select the patient.



l
n
m

<!-- page 69 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
68
EC17.0-PCD-01-A
Varian Confidential
3) Once a patient is selected, you may view their 2D images.
a) Select an image from the Context Window and drag it into the viewing window.
b) The image displays.












a
b

<!-- page 70 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
69
EC17.0-PCD-01-A
Varian Confidential
c) You may select several images to be displayed. Click the 2D drop-down and select the
number of images you wish to see.  In this example, select 3x3.




c

<!-- page 71 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
70
EC17.0-PCD-01-A
Varian Confidential
d) Select several images in the context window by holding down the shift key and drag them into
the viewing window.
e) The images are displayed.


f)
After viewing images, click Patient Selection to continue.








f
d
e

<!-- page 72 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
71
EC17.0-PCD-01-A
Varian Confidential
g) If the patient’s ID1 or Last Name are not the same, a Warning appears stating that you will
import the objects to a different patient.  Select Yes, for this example.



h) The system connects the objects.


4) The Connection area displays a Legend indicating various options.
a) You have the option to automatically Generate Volumetric Images for CT slices without
Structure Sets. Place a checkmark in the box.
b) Click
 to complete the import.







a
h
g
b
4

<!-- page 73 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
72
EC17.0-PCD-01-A
Varian Confidential
c) A Summary of the import is displayed giving information on what DICOM objects were
successfully imported and connected to the patient.
d) Green check marks beside each item indicate successful connection to the patient.
e) Clicking View Detailed Log allows you to view more details of the import.



d
e
c

<!-- page 74 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
73
EC17.0-PCD-01-A
Varian Confidential
5) We will continue to Contouring Application.
a) Click QuickLinks menu.
b) Select Treatment Planning.
c) Select Contouring.




a
c
b

<!-- page 75 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
74
EC17.0-PCD-01-A
Varian Confidential
 Eclipse Contouring
Section 1: Eclipse Contouring Overview
References
1) Image Registration and Segmentation Instructions for Use P1047687-002-B
2) Eclipse Photon and Electron Instructions for Use. P1047678-002-B
3) Image Registration and Segmentation Algorithms Reference Guide—P1038042-002-B

The intended use of the Contouring Workspace is to complement treatment planning system capabilities
allowing you to:
 Define segments or contours
Contouring is performed in the Contouring Application.  Students will successfully contour structures on
a 3D image, using several Contouring tools.
You will:
 Continue with patient US-EC-2222;
 Set User Origin
 Change Graphics View;
 Dock Drawing Tools;
 Add Structures;
 Review Drawing Toolbox.

<!-- page 76 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
75
EC17.0-PCD-01-A
Varian Confidential
Section 2:  Setting User Origin in Contouring Application
The imaging device used for patient imaging saves the DICOM origin to the image data. When the images
are imported into Eclipse, the user origin is created and positioned at the DICOM origin location. The user
origin can be used for automatically calculating the couch shift required for the patient treatment.
All information in Eclipse is related to positions (indicated with X, Y and Z coordinates), for example, the
isocenter and reference points are in relation to the DICOM origin or the user origin.
You can change the position of the user origin in a 3D image only before calculating the dose.


Note: You may want to change the User Origin in relation to the simulation isocenter
(fiducial markers) that were placed on the patient during the initial treatment planning scan.

1) The Contouring application opens with patient US-EC-2222 (from the DICOM Import application.)
2) To review or make changes to the User Origin:
a) Click User Origin under the Structure Set.
b) The User Origin defaults to the DICOM center, but we can move it to the tumor located in the
posterior upper right lung.

b
a

<!-- page 77 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
76
EC17.0-PCD-01-A
Varian Confidential
3) To Set User Origin:
a) Using the slider bars in each view, you will adjust the viewing planes to the tumor area.



a

<!-- page 78 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
77
EC17.0-PCD-01-A
Varian Confidential
b) Move the viewing planes to approximately: Z: 5.0; Y: 7.3; X: -5.9



b

<!-- page 79 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
78
EC17.0-PCD-01-A
Varian Confidential
c) Right click on User Origin.
d) From the menu, select Set User Origin…




c
d

<!-- page 80 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
79
EC17.0-PCD-01-A
Varian Confidential
e) The Set User Origin dialog box opens.
f)
To move the user origin to a desired amount from the current location, you can type values in
the X, Y or Z coordinates of the Offset from DICOM origin area.
g) In the Set to predefined target section, select from the menu.  For this example, select
Viewing plane intersection.
 DICOM origin – will place the DICOM origin back to the original DICOM, if it has been moved.
 Viewing plane intersection – will move the user origin to the intersection of the current viewing
plane.
 Keep X, Y and Z origin options will keep the origin in the original DICOM position.
h) Click OK.


e
f
g
h

<!-- page 81 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
80
EC17.0-PCD-01-A
Varian Confidential
i)
The User Origin is set to the viewing plane intersection indicated by the bold bright green
 intersection
  on each viewing plane.




i

<!-- page 82 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
81
EC17.0-PCD-01-A
Varian Confidential
Section 3:  Changing the Graphics View
1) To change the layout of the Graphics view,
a) Select the Select View Layout icon.
b) Select the desired layout. In this example, 3 Views is selected.





a
b

<!-- page 83 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
82
EC17.0-PCD-01-A
Varian Confidential
Section 4:  Options
Contouring allows the user to display or hide the structure list in the transversal view.
1) To view the Structure Set:
a) Right click on the
 icon in upper left of Transversal window.
b) Deselect the checkbox in front of Auto-hide Structure List.





a
b

<!-- page 84 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
83
EC17.0-PCD-01-A
Varian Confidential
2) When a 3D image is opened in the Contouring or Smart Segmentation applications, Eclipse
can automatically contour a Body structure if one is not detected.
 For the Body auto-contouring to occur, there cannot be any Body detected; not even a Body
‘container’
.
a) To turn on the Body auto-contouring, click Tools menu.
b) Select Options.






b
a

<!-- page 85 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
84
EC17.0-PCD-01-A
Varian Confidential
c) Options dialog box opens.
d) Click Automatic Body Search.
e) Click Automatic Body Search on CT Opening visibility checkbox.
Note: The Body auto-contouring works for CTs only.  This process does not support CBCTs
and MRIs.








d
e
c

<!-- page 86 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
85
EC17.0-PCD-01-A
Varian Confidential
3) The Drawing Tools may be docked or locked on the left or the right or allowed to float.
a) Select Main Window.
b) Select the desired position.  For this example, select Docked Right.
c) To show the drawing tools in the Tool Bar, select the checkbox.
d) Click OK.
Note: When selecting the Auto Hide options, the Drawing Tools will hide until the mouse is placed
over the left or right side of the screen.  The Floating option allows the Drawing Tools to be placed any
place on the screen and moved out of the way as needed.







a
b
d
c

<!-- page 87 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
86
EC17.0-PCD-01-A
Varian Confidential
Section 5:  Add Structures
Structures Overview
Structures may be added to the 3D image manually one-by-one or they can be added using a saved
Structure template or as part of a Clinical Protocol.
For contouring purposes, there is a structure dictionary with standardized labels for identifying structures.
The dictionary contains around 6500 labels. Each has a unique computer-readable structure code that
enables effective data mining and exchange of knowledge models between systems with different naming
schemes. Each structure must have a code.

Note: Structures are patient-wide objects (organs, treatment volumes, regions of interest)
that have image-specific geometric representations. These are formed when contoured or
segmented on 2D or 3D images. All Structures belong to a Structure Set, (a folder for these
objects.)

<!-- page 88 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
87
EC17.0-PCD-01-A
Varian Confidential
1) To manually add a new structure:
Note: When a new Structure Set is added to a 3D image that already contains one, a new
3D image (a copy of the original) is created for association to the new structure set.

a) Select the Structure menu from the Menu bar.
b) Select New Structure...



a
b

<!-- page 89 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
88
EC17.0-PCD-01-A
Varian Confidential
c) The Create New Structure dialog box opens
d) Start typing in Structure Code > Search Structure Code field.  For this example, type
CTV.

Note: You must select a pre-defined label from the dropdown list. The default Structure ID
is defined. To ensure interoperability between systems that do not implement the structure
codes, it is recommended to maintain the default structure IDs. They are editable however,
in the RT Administration workspace or in individual cases.




c
d

<!-- page 90 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
89
EC17.0-PCD-01-A
Varian Confidential
e) In this example, select CTV High Risk.
Note: The structure dictionary within Eclipse contains levels of risk associated with CTV.
This is predefined and can be used based on the clinical practice to assist in structure
significance



f)
Default Type and Color populate. These can be changed by using the dropdown and
selecting different options.  For this example, use the default.
g) Click Create.





e
f
g

<!-- page 91 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
90
EC17.0-PCD-01-A
Varian Confidential
h) The Structure name is created.
Note: Structure icon appears only half filled
 indicating that the structure exists but
no contours have been drawn. The color indicates the color of the structure. Once a contour
has been added to the structure the icon will be filled in






h

<!-- page 92 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
91
EC17.0-PCD-01-A
Varian Confidential
2) To add structures from a template:
a) From the Menu bar, select Structure.
b) From the drop-down menu, select New Structure from Template...




a
b

<!-- page 93 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
92
EC17.0-PCD-01-A
Varian Confidential
c) The Structure Templates dialog box opens.


Note: The default approval status for the structure template dialog box is Approved. If the
template is not in this approval status, use the Approval dropdown and select a different
status to locate the desired template.

d) Select the desired template. For this example, select US – 10 Lung Structures template.

Note: If the dataset already contains structures, the template will not create duplicates.
Note that Body and CTV_High are automatically deselected in this template.

e) Structures that will be created are checked. If desired, deselect any structures not needed.
For this example, leave all that are checked.
f)
Click Create Selected Structures.




c
d
e
f

<!-- page 94 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
93
EC17.0-PCD-01-A
Varian Confidential
g) The Structure Label Assignment dialog box opens.







g

<!-- page 95 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
94
EC17.0-PCD-01-A
Varian Confidential
h) For any structures with missing structure labels, select one from the Label dropdown list
Note: The Structure ID on the left is the name of the structure that the person creating the
template typed. The Label on the right is the synonym created in RT Administration that is
associated to the unique computer readable structure code that enables effective data
mining. Remember you must select a structure code for each structure you create.

i)
Click OK.




h
i

<!-- page 96 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
95
EC17.0-PCD-01-A
Varian Confidential
j)
The structures are added to the Structure List.




j

<!-- page 97 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
96
EC17.0-PCD-01-A
Varian Confidential
3) To change the color and/or style of any structure,
a) Right click on the structure name.
b) Select Properties…




b
a

<!-- page 98 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
97
EC17.0-PCD-01-A
Varian Confidential
c) The Properties dialog box opens.
d) Select the Structure tab.
e) From the Color drop-down, select the desired color and style.
f)
Click OK.




c
e
f
c
d

<!-- page 99 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
98
EC17.0-PCD-01-A
Varian Confidential
Section 6:  Drawing Toolbox
The drawing toolbox is a common container for all contouring tools. It is used for activation and
deactivation of drawing tools. The toolbox presents settings and help text of the currently active tool.
1) There are four tool groups:
a) Select Structures: This is the Default tool. It is always active when no other tool is active.
It allows for selecting structures by clicking on their contours in the image views
b) Manual Drawing: These tools allow for manual drawing and editing of contours. The main
interaction happens with the mouse in the image views.



a
b

<!-- page 100 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
99
EC17.0-PCD-01-A
Varian Confidential
c) Semi-Automatic Drawing Tools: These tools enable defining segments on a single plane
or on all planes in a 3D image either manually or automatically.





c

<!-- page 101 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
100
EC17.0-PCD-01-A
Varian Confidential
d) Point and Line Structures: allows for adding/drawing markers, reference lines or the
Calypso beacon.




d

<!-- page 102 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
101
EC17.0-PCD-01-A
Varian Confidential
Planar Drawing Tool
You can use the Planar Contour tool to define contours and segments on the active image plane with the
mouse either by clicking them point by point, or by drawing a continuous line. Contours and segments on
one plane can also be modified and optimized with the tool.

1) To begin contouring, select a structure.
a) In this example, select CTV_High.
b) Select the Draw Planar Contour icon from the Drawing Tools.





a
b

<!-- page 103 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
102
EC17.0-PCD-01-A
Varian Confidential
c) The Draw Planar Contour tool opens.
 The Add or Remove modes can be activated temporarily via the Ctrl and Shift keys.
 This Tool allows contouring in Transversal, Sagittal and Frontal views.
 The Deformation size (radius) is adjustable.
 Automatic Interpolation mode contours in empty slices.
 Automatic Extrapolation mode suggests contours in neighboring slices.




c

<!-- page 104 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
103
EC17.0-PCD-01-A
Varian Confidential
d) Using the Planar Contour Tool, draw a CTV_High contour. You can draw a continuous
line or place a dot move mouse place another dot, etc. to the end of contour. In this example,
the tumor volume is at about Z: 5.2cm.
e) Close the contour by returning to the starting point.
Note: If the Auto-hide Structure list is selected (as it is in this example), only the active
structure is visible.





d
e

<!-- page 105 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
104
EC17.0-PCD-01-A
Varian Confidential
f)
To deform the contour, select it and drag.



g) There may be times when you would like to see how the drawn contour will look like on the
next or previous slice to streamline contouring. To easily see the contour from the previous or
next slice, from the Toolbar, click the Show Contours from Previous and Next Plane
icon.





f
g

<!-- page 106 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
105
EC17.0-PCD-01-A
Varian Confidential
h) Scroll to the next or previous slice. Muted lines will display the drawn contour on the
previous or the next plane.




h

<!-- page 107 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
106
EC17.0-PCD-01-A
Varian Confidential
i)
To automatically interpolate between slices, place a checkmark in the Automatic
Interpolation checkbox with the Draw Planar Contour tool.

Note: There are two different modes of interpolation: The first mode is active when the
Correction Using Centers of Gravity option is unchecked and interpolates along the axis
perpendicular to the drawn slices. This mode is used for complex contours, like the ones
occurring in bowel segmentation.
The second mode is active when the Correction Using Centers of Gravity option is
checked and interpolates along the axis connecting the two centers of gravity of the
contours on those slices, between which the interpolation occurs. The second mode is used
for simpler cases where each slice normally only contains one simple contour. The system
automatically interpolates the contours on the skipped slices.


i

<!-- page 108 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
107
EC17.0-PCD-01-A
Varian Confidential
j)
Using the mouse wheel, scroll through several CT slices and draw another contour.
The contours between the two drawn are interpolated.

Note: Once there are at least few CT slices contoured, to more easily visualize the
structure in all viewing planes, right click on the structure name and select Move Viewing
Planes to Structure




j

<!-- page 109 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
108
EC17.0-PCD-01-A
Varian Confidential
k) To copy the last contour slice, select the contour and then type CRTL+C.  Scroll to another
slice and type CRTL+V.




k

<!-- page 110 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
109
EC17.0-PCD-01-A
Varian Confidential
l)
To allow Eclipse to suggest the next contour, place a checkmark in the Extrapolation
checkbox in the Draw Planar Contour tool.




l

<!-- page 111 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
110
EC17.0-PCD-01-A
Varian Confidential
m) Draw a new contour on a new CT slice and scroll to the following CT slice.
n) Eclipse will suggest the next contour. Left Click on the dashed line to accept it

Warning: Always approve the structures and images after the completion of segmentation to
avoid accidentally changing the definition of the patient anatomy or using of non-finished
structures.
Reference: Eclipse Photon and Electron Instructions for Use P1047678-002-B, page 73.

Caution: Make sure that a qualified physician reviews the accuracy and placement of all
patient structures (target structure and critical structures) used for treatment planning and for
evaluating the plans prior to patient treatment. Reference: Eclipse Photon and Electron
Instructions for Use P1047678-002-B, page 75.
Note: The higher the magnification of the image, the more controlled the adjustment will be.

o) To save click the Save Current Patient icon.

o
n

<!-- page 112 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
111
EC17.0-PCD-01-A
Varian Confidential
Brush Tool
The Brush can be used in 2D or 3D mode and may be used in the Transverse, Sagittal or Frontal views.
The brush can be Static or Adaptive.

Note: Keyboard shortcuts:
 Select 2 to toggle between 2D and 3D modes
 Select a to toggle between Static and Adaptive modes
 Select and hold Shift to change brush into Eraser (for best results change the brush to
2D Static prior to erasing).

1) To use the Brush tool:
a) Select Cord from the Structure Set.



a

<!-- page 113 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
112
EC17.0-PCD-01-A
Varian Confidential
b) Select Brush from the Drawing Tools.




b

<!-- page 114 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
113
EC17.0-PCD-01-A
Varian Confidential
c) The Brush tool opens.



2) Begin using the 2D Static Brush in the Transversal view.
a) Right click to adjust diameter using slider bar.

Note: Diameter can also be adjusted using the slider bar below or the slider bar in the
Brush tool controls or typing the desired diameter in the Brush tool controls.



c
a

<!-- page 115 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
114
EC17.0-PCD-01-A
Varian Confidential
b) Click to place the contour




b

<!-- page 116 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
115
EC17.0-PCD-01-A
Varian Confidential
c) To paint the Cord in the Sagittal view, select ‘2’ on the keyboard to toggle to 3D mode

Note: This mode can also be selected in the Brush tool controls.


d) To change the brush to Adaptive, select ‘a’ on the keyboard
Note: This mode can also be selected in the Brush tool controls




c
d

<!-- page 117 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
116
EC17.0-PCD-01-A
Varian Confidential
e) Complete the cord contouring on the sagittal plane using the adaptive brush. Once contouring
is complete, deselect the tool. Remember to check the results in all views prior to saving your
work.


f)
To save, click the Save Current Patient icon.
Note: To copy and paste a structure from one CT slice to another, the Drawer Planar
Contour tool (pencil) must be open.






f
e

<!-- page 118 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
117
EC17.0-PCD-01-A
Varian Confidential
Segmentation Wizard
The Segmentation Wizard provides pre-configured organ-specific settings for segmentation. The area
where the Segmentation Wizard works is either the VOI, if activated, or the entire 3D image. The following
organs are included:
 Brain:  Segmentation starts by finding and selecting bones resembling the skull on planes inside
the body structure and flood fill is used to fill the brain.
 Lungs:  Segmentation first finds a slice with most air inside the body structure in two connected
areas the uses flood fill to fill the lungs
 Eyes:  Segmentation first finds a point inside each eye and then the eye segment is generated
around these points using the flood fill algorithm.
 Spinal cord:  Segmentation is based on the k-NN algorithm
 Bones:  Segmented by selecting points with a CT value typical of bone structures.


Note: The Body Structure must be defined before using the Segmentation Wizard.

<!-- page 119 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
118
EC17.0-PCD-01-A
Varian Confidential
1) To begin LUNG_RT segmentation:
a) Select LUNG_RT from the Structure list.
b) Move the viewing plane sliders over the right lung.




a
b

<!-- page 120 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
119
EC17.0-PCD-01-A
Varian Confidential
2) Select the Segmentation Wizard tool.




2

<!-- page 121 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
120
EC17.0-PCD-01-A
Varian Confidential
a) The Segmentation Wizard dialog box opens.
b) The Lungs option is automatically selected.
c) The Target Structure defaults to LUNG_RT.  This can be changed with the dropdown.
d) Click Select VOI box.




a
b
c
d

<!-- page 122 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
121
EC17.0-PCD-01-A
Varian Confidential
e) Adjust the VOI to the right lung area using all three viewing planes to restrict the automatic
tool.




e

<!-- page 123 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
122
EC17.0-PCD-01-A
Varian Confidential
f)
Click Apply.
Note: The VOI is only active for automatic contouring tools. The VOI is persistent. When
switching to other structures adjust VOI accordingly.

g) If results are not acceptable, click Undo.  For this example, do not click Undo.

Note: After Undo, change parameters as appropriate and click Apply





f
g

<!-- page 124 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
123
EC17.0-PCD-01-A
Varian Confidential
h) The RT Lung segment is created.
i)
Once contouring is complete, deselect Segmentation Wizard
 icon.
j)
To save click the Save Current Patient icon.






h
i
j

<!-- page 125 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
124
EC17.0-PCD-01-A
Varian Confidential
Post Processing Tools
The Post Processing tools are a group of tools used to clean up and smooth structures. Each of the Post
Processing tools (options) can be used individually or together.
1) To post process, click Post Processing in the Drawing Tools toolbox.




1

<!-- page 126 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
125
EC17.0-PCD-01-A
Varian Confidential
Post Processing tools include:
 Clean-up: Used for removing parts from the active structure. These parts are typically not
connected to the main structure. Parts smaller than a defined size in square or cubic centimeters,
parts selected with the mouse, or overlapping parts can be eliminated.
 Extraction: Keeps defined parts in an active structure. Parts selected with the mouse can be
kept. Parts may be connected or disconnected, keeping the parts exceeding a defined size in
centimeters. When connecting or disconnecting parts, joints may be created between separate
segments that belong to the active structure.
 Enhancement: Removes unwanted details from the active structure. Small protruding spikes,
valleys dipping into the structure and selected cavities within a structure can be smoothed.
Selected cavities or cavities smaller than a defined size in square centimeters can be filled.
 The Post Processing tools can be used for the active 2D image, all 2D images or the volume
image.
 Post processing options define how the post processing tool will be applied to the data set. The
2D, 2D All or 3D option must be selected.
 2D: The post processing operations are applied on the active image plane only.
 2D All: The post processing operations are applied on all 2D image planes separately.
 3D: The post processing options are applied to the image volume as a whole, including the
volume between the 2D image planes.
 Target Structure: The structure that will be Post Processed; to which any changes made will be
stored.
Note: It is important to Post Process each structure contoured using either Manual or
Automatic Tools. For more information refer to Image Registration and Segmentation
Instructions for Use, P1047687-002-B.

<!-- page 127 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
126
EC17.0-PCD-01-A
Varian Confidential
2) Select Post Processing
 from the Drawing Tools.  Post Processing tool dialog box opens.
a) Select Clean Up.
b) Select Remove Parts Smaller than 0.5 cm3.
Note: This option removes all unwanted parts smaller than a specified size in square or
cubic centimeters.

c) Select 3D.
d) Select LUNG_RT from the Target Structure dropdown.
e) Click Apply.


a
d
c
e
2
b

<!-- page 128 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
127
EC17.0-PCD-01-A
Varian Confidential
f)
Deselect “Remove Parts Smaller than”.
g) Click Remove Selected Parts.

Note: This option allows the user to select parts to be removed using the mouse.

h) Click the Select visibility box.  For this example, scroll to where there is a contour in the liver
area (~slice Z -5.94)




f
g
h

<!-- page 129 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
128
EC17.0-PCD-01-A
Varian Confidential
i)
Place the mouse over the area to be removed.
j)
Select 2D.
k) Click Apply.




i
j
k

<!-- page 130 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
129
EC17.0-PCD-01-A
Varian Confidential
l)
The stray contour is removed

Note: Select shift key to place additional ‘X’s to remove additional parts.


m) To save click the Save Current Patient icon.




l
m

<!-- page 131 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
130
EC17.0-PCD-01-A
Varian Confidential
n) Deselect Remove selected parts.
o) Select Remove parts outside, from the drop-down select BODY.
p) Select 2D All.
q) Click Apply.
Note: This option allows the user to remove parts outside of a structure. In the example
below, this selection would remove any stray pixels or contours that may have been placed
outside of the body. For example, if the physician accidentally clicked outside the body
while contouring the PTV, these pixels would need to be removed prior to optimization.




o
n
p
q

<!-- page 132 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
131
EC17.0-PCD-01-A
Varian Confidential
r)
Deselect Clean Up.




r

<!-- page 133 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
132
EC17.0-PCD-01-A
Varian Confidential
3) Select Extraction to enable the extraction tools. For this example, scroll to about Y=-5.06 in the
frontal view.
Note: Keep selected parts enable keeping selected parts only and remove all other parts.

a) Select Keep the ‘n’ largest parts.
b) Type 1 in the n: box.
c) Select Modify Connections Before Extraction.
Note: Modify Connection Before Extraction allows the user to connect or disconnect
smaller parts from larger, prior to keeping the largest part



a
3
b
c

<!-- page 134 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
133
EC17.0-PCD-01-A
Varian Confidential
d) Select Disconnect.
e) Type 0.50 in the Radius box.
f)
Select 3D.
g) Click Apply.



d
e
f
g

<!-- page 135 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
134
EC17.0-PCD-01-A
Varian Confidential
h) Contours before Extraction.
i)
Contours removed.


j)
Deselect Extraction.


k) To save click the Save Current Patient icon.




h
i
j
k

<!-- page 136 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
135
EC17.0-PCD-01-A
Varian Confidential
4) Select Enhancement.
a) Select Smoothing.
b) Select level 1.

Note: Smoothing Levels range from 1 to 20, level 20 applying the maximum smoothing.
The higher the smoothing value the more it smooths out the segmented structure.

c) Select 3D.
d) Click Apply.



4
a
b
c
d

<!-- page 137 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
136
EC17.0-PCD-01-A
Varian Confidential
e) Deselect Smoothing.
f)
Select Fill all cavities. For this example, scroll to transversal slice Z -1.75
g) Select 2D All.
h) Click Apply.




e
f
g
h

<!-- page 138 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
137
EC17.0-PCD-01-A
Varian Confidential
i)
Before Fill all cavities in 3D (View slice Z -1.75).
j)
After Fill all cavities.




i
j

<!-- page 139 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
138
EC17.0-PCD-01-A
Varian Confidential
k) To demonstrate Fill selected cavities, click Undo.
l)
Select Fill selected cavities.
m) Deselect Fill all cavities.
n) Select 2D.
o) Click Select.




k
l
m
o
n

<!-- page 140 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
139
EC17.0-PCD-01-A
Varian Confidential
p) Click the structure.

q) Click Apply.


B
p
q

<!-- page 141 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
140
EC17.0-PCD-01-A
Varian Confidential
r)
Before Fill selected cavities
s) After Fill selected cavities applied.




r
s

<!-- page 142 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
141
EC17.0-PCD-01-A
Varian Confidential
t)
Use Fill cavities smaller than to fill cavities within a structure smaller than a specified size.
If using 2D or 2D-All, the system will search for cavities in cm2.  If using 3D, the system will
search for cavities in cm3.



u) To save click the Save Current Patient icon



t
u

<!-- page 143 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
142
EC17.0-PCD-01-A
Varian Confidential
Flood Fill
1) The Flood Fill tool fills an area that contains similar CT values either in 2D or 3D starting from
one or more seed points that you define. The flood fill operation can be controlled by a growing
factor.


Note: To enhance the visualization the desired structure, adjust the window and level
settings.

a) From the structure set, select Lung_LT.
b) Move the viewing planes to center the left lung.
c) Select Flood Fill.



a
c
b

<!-- page 144 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
143
EC17.0-PCD-01-A
Varian Confidential
d) The Flood Fill tool opens.
e) Click Select VOI icon.



d
e

<!-- page 145 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
144
EC17.0-PCD-01-A
Varian Confidential
f)
Adjust VOI around the left lung.



f

<!-- page 146 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
145
EC17.0-PCD-01-A
Varian Confidential
g) Define the seed point by clicking in the structure.

Note: You can move the seed point by clicking again in the viewing window.







g

<!-- page 147 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
146
EC17.0-PCD-01-A
Varian Confidential
h) Adjust the Volume Growing Intensity with the slider or by typing a percentage in the box
and use 3D. Volume Growing Intensity for this example, type 35.
i)
Click Apply.
j)
The structure is contoured.


k) To save click the Save Current Patient icon.


2) Post Process Lung_LT as in steps 3 through 5y.



i
j
h
k

<!-- page 148 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
147
EC17.0-PCD-01-A
Varian Confidential
Crop Structure Tool
1) To crop one structure from another:
a)  Click Crop Structure.
Note: For this example, the structure Lung_R sub CTV will be created. You may also use
this tool if the CTV has been defined outside the Body and you want to remove that part of
the CTV.




a

<!-- page 149 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
148
EC17.0-PCD-01-A
Varian Confidential
2) Crop Structure tool dialog box opens.
a) Select LUNG_RT from the Crop Structure dropdown
b) Select CTV_High from the Remove part extending inside: dropdown
c) Select <New…> from the Target Structure dropdown



a
b
c

<!-- page 150 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
149
EC17.0-PCD-01-A
Varian Confidential
d) The Create New Structure dialog box opens.
e) Select a label from the Structure code dropdown. In this example select Lung Right
f)
Type the ID.  For this example, type Lung Sub PTV.
g) From the Type dropdown.  For this example, select Organ.

Note: The Color and style will default to the color and style assigned in RT Administration
for the structure type. This default color and style can be changed using the dropdown

h) Click Create.




e
f
h
d
g

<!-- page 151 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
150
EC17.0-PCD-01-A
Varian Confidential
i)
Click Apply.
j)
Lung R sub CTV structure is created.

Note: To view the CTV_High in all planes, right click on structure and select Move Viewing
Planes to Structure.



k) To save click the Save Current Patient icon




i
j
k

<!-- page 152 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
151
EC17.0-PCD-01-A
Varian Confidential
Boolean Operators
Boolean operators create combinations of structures, such as total lungs or the part of the lungs that does
not overlap with the PTV.
1) Select Boolean Operators tool.




1

<!-- page 153 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
152
EC17.0-PCD-01-A
Varian Confidential
2) Boolean Operators tool opens.
a) Select Lung Total in the Target Structure dropdown.



a
2

<!-- page 154 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
153
EC17.0-PCD-01-A
Varian Confidential
b) Select Lung_LT from First Structure dropdown.
c) Select Create a union of the first and second structure icon.
d) Select Lung_RT from Second Structure dropdown.
e) Click Apply.





b
d
c
e

<!-- page 155 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
154
EC17.0-PCD-01-A
Varian Confidential
f)
Total Lung results.
Note: Whenever an automatic contouring tool is used, all contours should be reviewed for
accuracy and post process if necessary.




f

<!-- page 156 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
155
EC17.0-PCD-01-A
Varian Confidential
g) To save click the Save Current Patient icon.



g

<!-- page 157 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
156
EC17.0-PCD-01-A
Varian Confidential
Expand CTV into PTV
The Margin for Structure tool will add a three-dimensional margin around a defined structure. The tool
expands the selected structure with a specified margin. This tool is useful if you want to create a PTV
from GTV or CTV. The margin can be symmetric or asymmetric.
1) Select Margin for Structure.




1

<!-- page 158 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
157
EC17.0-PCD-01-A
Varian Confidential
2) Margin for Structure dialog box opens.
a) Select CTV_High from Create Margin From drop-down.
b) Select Create outer margin.
c) Select the Use symmetrical margin visibility checkbox.



a
b
c
2

<!-- page 159 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
158
EC17.0-PCD-01-A
Varian Confidential
d) Type 0.5 in the margin field.
e) Select PTV Lung from the Target Structure drop-down.
f)
Click Apply.



d
e
f

<!-- page 160 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
159
EC17.0-PCD-01-A
Varian Confidential
g) PTV Lung is created from CTV_High.
Note: To view the PTV Lung in all planes, right click on the structure and select Move
viewing planes to structure

Note: Structures created from other structures (as is the case with Margin for Structure tool
and Boolean operations) are not automatically updated if the original structure is modified.
In this example, if you change the CTV_High, the PTV Lung would need to be updated.




g

<!-- page 161 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
160
EC17.0-PCD-01-A
Varian Confidential
h. To save click the Save Current Patient icon.




h

<!-- page 162 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
161
EC17.0-PCD-01-A
Varian Confidential
Extract Wall Tool
The Extract Wall tool is used to create a ring structure. Both the inner and outer wall margins can be
used. For this example, the cord is going to be used to create an Expanded Cord. This tool is also
commonly used for bladder or rectal structures.
1) To create the Cord_Expanded structure from the Cord structure, select Extract Wall.




1

<!-- page 163 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
162
EC17.0-PCD-01-A
Varian Confidential
2) Extract Wall dialog box opens.
Note: The first part of this step is to display how to create an Outer and Inner Wall for
structures. You would not leave a gap between the cord and the expanded cord.

a) Select Cord from the Extract from dropdown.
b) Type 0.7 cm in the Outer wall margin field.
c) Type -0.2 cm in the Inner wall margin field.
d) Select Cord_Expanded from the Target Structure.
e) Click Apply.


a
b
c
d
e

<!-- page 164 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
163
EC17.0-PCD-01-A
Varian Confidential
f)
 Cord_Expanded structure is created.
g) Click Undo button.




f
g

<!-- page 165 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
164
EC17.0-PCD-01-A
Varian Confidential
h) Change the Inner wall margin from -0.20cm to 0.00.
i)
Click Apply.
Note: To view the Cord_Expanded in all planes, right click on structure and select Move
Viewing Planes to Structure.



j)
To save click the Save Current Patient icon.



h
i
j

<!-- page 166 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
165
EC17.0-PCD-01-A
Varian Confidential
Manually Contour Body Structure
There may be occasions when it is necessary to manually contour the Body Structure.
1) For this exercise clear the Body Structure.
a) Right click on Body Structure.
b) Select Clear Structure.
c) Select Clear from All Planes.




a
b
c

<!-- page 167 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
166
EC17.0-PCD-01-A
Varian Confidential
d) Select Search Body from the Drawing Tools.




d

<!-- page 168 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
167
EC17.0-PCD-01-A
Varian Confidential
2) The Search Body dialog box opens.
a) The Ranger Lower Threshold is set to default at -350. Use this value.
b) Click + Post Processing to open the attached post processing tool. Keep default values for
this example.
Note: The Search Body tool is the only tool with attached Post Processing. There are fewer
options available, but they function the same as the Post Processing tool.
c) Click Select VOI.
Note: Adjust the VOI to cover the body. You may need to adjust the VOI to exclude
accessories such as a breast board.

d) Click Apply.


2
a
b
c
d

<!-- page 169 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
168
EC17.0-PCD-01-A
Varian Confidential
e) The Body is contoured.



f)
To save click the Save Current Patient icon.




e
f

<!-- page 170 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
169
EC17.0-PCD-01-A
Varian Confidential
Section 7:  Approve Structure
All structures have an ‘unapproved’ status as the default so that they may be modified.


Note: Structures will be approved automatically when the plan is approved if Structure
approval on plan approval has been selected in RT Administration > Systems and
Facilities > System Properties.
Note: Approved structures cannot be modified. Changing the status to “Approved” can
prevent unintended edits. A good practice may be to change the CTV to Approved while
other contouring is being completed.

1) Select a structure in the Structure Set.
a) For this example, select CTV_High.
b) Select the Structure menu.
c) Select Set Structure Status.
d) Select Approved.
c
b
a
d

<!-- page 171 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
170
EC17.0-PCD-01-A
Varian Confidential
2) The Status Change Confirmation dialog box opens.
a) Select any structure you want to be approved.
b) Click OK.




a
b

<!-- page 172 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
171
EC17.0-PCD-01-A
Varian Confidential
c) Type User Name and Password.
d) Click ‘Yes’.



e) To save click the Save Current Patient icon




e
c
d

<!-- page 173 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
172
EC17.0-PCD-01-A
Varian Confidential
Contouring High-Density Artifacts for
Acuros®XB
Section 1: High-Density Artifacts Overview
Objectives
With this procedure, you will contour high density artifacts. These artifacts may cause the Acuros XB
calculation to fail if they are not assigned HUs.
References
1) Eclipse Photon and Electron Reference Guide- P1047679-001-A
2) Eclipse Photon and Electron Instructions for Use. P1047678-002-B
3) DICOM Import and Export Reference Guide P1034778-002-B

<!-- page 174 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
173
EC17.0-PCD-01-A
Varian Confidential
Section 2: General Information
When the Acuros®XB algorithm is used for final dose calculation, consideration must be given to any high
density non-biologic materials located within the external contour.
High density portions of implanted fiducials, contrast agents within the patient, dental work,
prosthesis, artifact from high densities will most likely require delineation as well. Each type of material
with different HU would be contoured as a separate item.
The Acuros XB algorithm stops the calculation if an HU value in the CT image is higher than or equal to
the maximum HU value defined in the CT calibration curve. The volume spanned by CT image pixels
whose mass density (derived either from the HU value in the image or assigned to a structure) exceeds
the maximum mass density of the materials used in automatic conversion (3.0 g/cm3) is calculated.
If this volume is higher than a user defined maximum volume for automatic material assignment to high
density artifacts, the calculation is prevented until a material is assigned to a structure. For smaller
volumes, automatic conversion to a user defined material takes place. This is to prevent incorrect material
assignment to a significant volume of a high-density material.
Eclipse has 2 tools to help with contouring of high-density structures: 1. Segment High Density Artifacts
available in Contouring; 2. Segment High Resolution available in External Beam Planning.
 The Segment High Density Artifacts tool is an automatic tool. It will automatically contour artifacts
that have a density of 3.0gm/cc or above.

The BODY must be defined before using this tool.

A 1mm margin is added to the structure to ensure that even the smallest artifacts are
contoured

Any high densities outside of the Body contour will be ignored.

If the tool does not work, check the HUs of the artifacts that should be contoured. If the HUs
are not 3.0gm/cc or above, the tool will not recognize them, and it will be necessary to use the
Segment High Resolution technique.
 Using the Segment High Resolution tool is a 2-step process.


Note: Contouring of the high-density artifacts may be done prior to planning while
contouring the other structures or can be completed if/when the calculation fails. If the
calculation fails, the system will display the coordinates of the high densities causing the
issues and giving additional guidance to the user.

<!-- page 175 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
174
EC17.0-PCD-01-A
Varian Confidential
1) Proceed to Contouring Workspace: QuickLinks, select Treatment Planning, select Contouring.
2) Open patient: US-EC-2010, EC OPS, FIDUCIALS.  See Figure 1.

Figure 1: Select Patient
3) The 3D image opens with the Structure Set.
 A previously contoured 3D image will be utilized for purposes of this lab exercise.
 This patient has implanted fiducial markers as well as fiducials on the skin.  See Figure 2.

Figure 2: 3D image with Structure Set

<!-- page 176 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
175
EC17.0-PCD-01-A
Varian Confidential
Section 3: Contouring with High Density Artifacts Tool
In the Contouring Workspace, the high HU non-biologic material will be delineated.
For this exercise, a structure, Fiducials, has been created.
 You can create a new structure for the high-density material. Go to: Structure dropdown, select
New Structure.
1) Select the Fiducials structure in the Structure Set.  See Figure 3.

Figure 3: Fiducials structure

<!-- page 177 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
176
EC17.0-PCD-01-A
Varian Confidential
2) Select the Segment High Density Artifacts tool from the Toolbox. See Figure 4.

Figure 4: Select Segment High Density Artifacts tool
 Any densities 3.0gm/cc or over, will be automatically contoured.
 The VOI tool may be used to limit the area to be contoured.

<!-- page 178 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
177
EC17.0-PCD-01-A
Varian Confidential
3) The Segment High Density Artifacts dialog box appears explaining how the tool works. If
any contours exist for the targeted structure, they will be overwritten.
a) Click the Apply to continue with auto contouring.  See Figure 5.

Figure 5: Segment High Density Artifacts dialog box

<!-- page 179 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
178
EC17.0-PCD-01-A
Varian Confidential
b) The Fiducials are automatically contoured.  See Figure 6.

Figure 6: Fiducials are contoured
4) To assign CT Values and Material Densities to the structure, right click on the Structure, select
Properties.  See Figure 7.

Figure 7: Right click on Structure > Properties

<!-- page 180 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
179
EC17.0-PCD-01-A
Varian Confidential
5) The Properties dialog box opens. Select the CT Value and Material tab.
a) Select the Assign  CT Value visibility checkbox; select the Assign Material visibility
checkbox; select Material from the dropdown. See Figure 8.


Figure 8: Properties dialog box > CT Value and Material tab

<!-- page 181 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
180
EC17.0-PCD-01-A
Varian Confidential
 The structure is automatically turned to a high accuracy structure.

The high accuracy or high-density structures are used for small structures, such as fiducials
or the optic chiasm. These structures can have a significant impact on the calculation.

It may be necessary to use a higher resolution than with larger structures when contouring
these structures. Once the resolution is increased on a structure, it cannot be changed.

The Segmentation Wizard does not use the high-resolution structures due to memory
consumption.

Structures saved in Structure Templates are all low-resolution structures even if some of
those structures were originally high-resolution structures.

Segmentation tools use either low or high resolution, depending on the resolution of the
structure being segmented.

Import uses automatic, low or high resolution.

Automatic = the system determines the best resolution and imports smallest structures
with high resolution if necessary.

High = all structures except Body, bolus, and support structures are imported with high
resolution.

Low = all structures are imported with standard resolution.
b)  Select the Tech (Struc) tab.  Review Segment Resolution.
6) Click OK.  See Figure 9.

Figure 9: Tech (Struc) tab > Segment Resolution

<!-- page 182 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
181
EC17.0-PCD-01-A
Varian Confidential
Note: It is possible that a Physical Material may not be able to be assigned to the structure
if the Structure or Structure Set does not have a Physical Materials Table assigned. This
may happen if the calculation model was changed from Version 10 to Version 13. A warning
will appear on the CT Value and Material tab. See Figure 10.

Figure 10: Need to Assign Material Table

<!-- page 183 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
182
EC17.0-PCD-01-A
Varian Confidential
Note: To Assign a Material Table in Contouring, right click on 3D image >
select Properties, Select Series tab. Structure Set Imager from Imaging Device. Return to
Structure Properties dialog box > CT Value and Material tab > Physical Material Table.  See
Figure 11.


Figure 11: Structure Set Properties > CT Value and Material tab > Physical Material Table

<!-- page 184 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
183
EC17.0-PCD-01-A
Varian Confidential
 External Beam Planning
Section 1: External Beam Planning Overview
References:
1) Eclipse Photon and Electron Reference Guide P1047679-001-A
2) Eclipse Photon and Electron Instructions for Use P1047678-002-B
3) Eclipse Photon and Electron Algorithms Reference Guide P1047677-001-A

External Beam Planning application provides tools for treatment planning. In this procedure, we will cover:
 Navigating to the External Beam Planning Application
 Adding Couch Structures to the Data Set
 Create a New Plan
 Setup Fields
 AAA Dose Calculation and Field Normalization
 Acuros XB, Dose calculation and Field Normalization
 Reference Points and Dose Prescription Volumes (DPV)
 Electron Plans
 Plan Approval and Delta Couch Shift
 Creating Templates
 Revisions
 Field Alignment
 Create New Plan from Previous Field Alignment Fields
 Field in Field
 Plan Sums

<!-- page 185 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
184
EC17.0-PCD-01-A
Varian Confidential
Section 2:  Navigate to External Beam Planning Application
1) We will continue with patient US-EC-2222, EC OPS LUNG PT already open in Contouring.
a) Click External Beam Planning from the Workspace Bar.




a

<!-- page 186 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
185
EC17.0-PCD-01-A
Varian Confidential
2) The External Beam Planning application opens, displaying US-EC-2222, EC OPS, LUNG PT.
a) To view or hide all contoured structures, place a check (or deselect check) in the
Structure Set checkbox in the Focus window. In this example, CT_1.





2
a

<!-- page 187 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
186
EC17.0-PCD-01-A
Varian Confidential
Section 3: Adding Couch Structures to the Data Set
1) To add new couch structures:
a) Navigate to the Insert menu.
b) Select New Couch Structure…

a
b

<!-- page 188 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
187
EC17.0-PCD-01-A
Varian Confidential
2) The Create Couch Structures dialog box opens.

Note: When inserting couch structures in an image make sure you select the correct couch
profile and that the couch structures are positioned correctly. Visually verify the correctness
of couch structure in each image plane. Refer to: Eclipse Photon and Electron Instructions
for Use, P1047678-002-B

Note: Before using a couch structure for actual treatment, verify the HU values and
resulting dose distribution using a phantom.

Note: If the Couch Profile selected has movable structural rails, select their correct position,
in or out.

<!-- page 189 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
188
EC17.0-PCD-01-A
Varian Confidential
a) Select couch from the Select couch profile dropdown. For this example, select Exact IGRT
Couch, medium.
b) The CT Values may be changed and then saved as the default for selected couch, check the
Save CT values as defaults for the selected couch check box. For this example, leave the
check box unchecked.
c) Click OK.





a
b
c

<!-- page 190 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
189
EC17.0-PCD-01-A
Varian Confidential
d) If the planning image is too small, click Yes.

Note: If the 3D image is too small to fit the couch structures and you choose not to enlarge
the image, some couch structures might not be created completely. This can cause
inaccuracies in dose calculation. Refer to Eclipse Photon and Electron Instructions for Use,
P1047678-002-B.





e) Couch structures are created.

d
e

<!-- page 191 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
190
EC17.0-PCD-01-A
Varian Confidential
3) Select Save All.


3

<!-- page 192 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
191
EC17.0-PCD-01-A
Varian Confidential
4) We will move the couch structure
a) Select the couch structure.

Note: Couch structures can be moved in the transversal image view. The couch structures
may be moved anteriorly/posteriorly or right/left. They cannot be moved superiorly/inferiorly.

b) Select Move Support Structure tool.
c) Move cursor to structure and move it as needed.
d) For this exercise, click Reload to return Couch structure to its original position.






d
c
b
a

<!-- page 193 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
192
EC17.0-PCD-01-A
Varian Confidential
Section 4:  Create a New Plan
Plans are attached to the active image/structure set. If necessary, drag the appropriate 3D image or
structure set to the active view.
1) To create a new plan:
a) Select Insert from the Menu bar.
b) Select New Plan…





a
b

<!-- page 194 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
193
EC17.0-PCD-01-A
Varian Confidential
c) The Select Course dialog box appears.
d) Click New Course…




d
c

<!-- page 195 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
194
EC17.0-PCD-01-A
Varian Confidential
e) Course Properties dialog box open.
f)
Change any information as needed.
g) Click OK.


e
f
g

<!-- page 196 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
195
EC17.0-PCD-01-A
Varian Confidential
h) The newly created course is available. Click Next > when Select Course dialog box re-opens.




h

<!-- page 197 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
196
EC17.0-PCD-01-A
Varian Confidential
i)
The Plan Details dialog box opens.
j)
Change Plan ID to Rt Lung.
k) Add Dose per Fraction = 200cGy.
l)
Add Number of Fractions = 25.
m) Click Next >.



j
k
m
i
l

<!-- page 198 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
197
EC17.0-PCD-01-A
Varian Confidential
n) The Select Plan Target Structure dialog box appears.
o) For this example, select PTV Lung from the Available Structures list.
Note: You can select No plan target, for example with electron plans.
p) Click Next >.






p
o
n

<!-- page 199 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
198
EC17.0-PCD-01-A
Varian Confidential
q) The Select Primary Reference Point dialog box opens.
r)
Click New Reference Point…





r
q

<!-- page 200 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
199
EC17.0-PCD-01-A
Varian Confidential
s) The Reference Point Properties dialog box opens.
t)
Select the Type as Target.
u) Add Total Dose Limit = 5000cGy.
v) Add Daily and Session Doses = 200.
w) Click OK.






v
u
w
s
t

<!-- page 201 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
200
EC17.0-PCD-01-A
Varian Confidential
Note: Once you click OK for the Plan Properties, a new “reference point” is added to the
plan and is visible in the Focus window. This reference point does not have a location. You
cannot select the checkbox in front of it. It is known as a Dose Prescription Volume and is
used by Eclipse to track the prescription dose. We will go over this in more detail later in
this lesson.

<!-- page 202 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
201
EC17.0-PCD-01-A
Varian Confidential
x) Click Next > when the Select Primary Reference Point dialog box reopens.



y) The Select Treatment Machine dialog box opens.
z) Select iX100 from the list.
aa) Click Next >.



x
y
z
aa

<!-- page 203 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
202
EC17.0-PCD-01-A
Varian Confidential
bb) The Select Patient Position dialog box opens.
cc) Select Head First-Supine.

Note: Plan patient position is set here; the image orientation is not changed here.


dd) Click Next >.







bb
dd
cc

<!-- page 204 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
203
EC17.0-PCD-01-A
Varian Confidential
2) The Field Properties dialog box opens.
a) Select General tab.
b) Enter Field ID. For this example, type Field 1- RAO.
c) Enter Field Name. For this example, type RAO.



a
b
c

<!-- page 205 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
204
EC17.0-PCD-01-A
Varian Confidential
d) Select Energy from the dropdown. For this example, select 6X.
e) Select Dose Rate from the dropdown. For this example, select 600.
f)
Select Tolerance from the dropdown. In this example, select T1.






d
f
e

<!-- page 206 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
205
EC17.0-PCD-01-A
Varian Confidential
g) Select Geometry tab.
h) Select Technique from the drop-down. For this example, click STATIC.
i)
Enter Gantry Rtn. For this example, 330.
Note: If the Administrator has set defaults for the selected treatment unit in RT
Administration, the Gantry, Collimator, Field Sizes, and Couch will already be populated.
These can be edited at this time.



g
i
h

<!-- page 207 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
206
EC17.0-PCD-01-A
Varian Confidential
j)
Enter Coll Rtn. For this example, 0.0.
k) Enter Field X and Field Y. For this example, both 10.0cm with Assymmetrical checked.
l)
Enter Couch Rtn. For this example, 0.0.




k
l
j

<!-- page 208 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
207
EC17.0-PCD-01-A
Varian Confidential
m) Select Room Geometry tab.
n) Enter Couch values. For this example, leave the default information.
o) Enter Imager values. For this example, leave the default information.

Note: If the Administrator has set defaults for the selected treatment unit in RT
Administration, the Couch and Imager values will already be populated. They can be edited
at this time.




o
n
m

<!-- page 209 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
208
EC17.0-PCD-01-A
Varian Confidential
p) Select Accessories tab to enter necessary accessories. For this example, there will be no
accessories.
q) Click OK.



q
p

<!-- page 210 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
209
EC17.0-PCD-01-A
Varian Confidential
r)
Click Save All.


s) The first field is added to the plan.
Note: Eclipse will place the isocenter at the center of the target volume. If the target volume
is ‘None’, the isocenter will be placed in the geometric center of the 3D Image. The
isocenter can be relocated to any position.

t)
The isocenter is displayed in X, Y, and Z coordinates.





Note: Starting in V15.5, Eclipse allows for several isocenter groups per plan. For more
information, see Eclipse Photon and Electron Reference Guide P1047679-001-A.
r
t
s

<!-- page 211 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
210
EC17.0-PCD-01-A
Varian Confidential
Adjusting field parameters manually
1) You can move the isocenter manually. There may be times when a target volume has not been
contoured as in a breast tangent case. To move the isocenter in any view:
a) From the Fields folder in the Focus window, select a field. For this example, select Field 1-
RAO.
b) Click the isocenter and drag to desired position. For this example, drag to the left lung.

c) Isocenter moved to the new position.




b
c
a

<!-- page 212 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
211
EC17.0-PCD-01-A
Varian Confidential
d) To align the isocenter back to the target structure, right click on the Isocenter Group 1.
e) Select Align Fields in Isocenter Group 1 > Structure >.
f)
Select the target. In this example, select PTV Lung.


2) The viewing planes may be moved independently of the isocenter.
a) To move the viewing planes to the isocenter, right click on the Isocenter Group.
b) Select Move Viewing Planes to Isocenter/Entry Point.






d
e
f
a
b

<!-- page 213 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
212
EC17.0-PCD-01-A
Varian Confidential
c) The viewing planes are now at the isocenter.


3) To move viewing planes to Beam’s Eye View:
a)  Right click anywhere in the Model View.
b) Select Set Beam’s Eye View to Field 1-RAO.





c
b
a

<!-- page 214 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
213
EC17.0-PCD-01-A
Varian Confidential
c) The Beam’s Eye View displays.
d) You can adjust any parameter in any view by grabbing the red handle(s)
.   For this
example, use the red handles in all views to adjust parameters.



e) The parameters are changed manually.


e
c
d

<!-- page 215 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
214
EC17.0-PCD-01-A
Varian Confidential

f)
To manually define the parameters, type the information in the Info window.  For this
example, type:
i)
Gantry = 330.0
ii) Coll Rtn. = 0.0
iii) Couch Rtn. = 0.0
iv) X = -0.23
v) Y = -0.10
vi) Z = -0.11
g) Click Enter on keyboard to ensure changes are made.
h) The parameters are set to the information you typed.
Note: Depending on which view you choose, the red handle moves the parameters
differently. For example selecting and moving the red handle in the Transverse view moves
only the gantry. Selecting and moving the red handle in the Sagittal view moves the gantry,
couch and collimator. The red handle in the right corner of the BEV field will move the
collimator.





f
h

<!-- page 216 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
215
EC17.0-PCD-01-A
Varian Confidential
Insert a Digitally Reconstructed Radiograph (DRR)
A DRR is an X-ray image computed by the application seen from the beam focus. The final DRR image is
a weighted composition of DRR layers of which there can be one to three layers per DRR.
1) To add a DRR to a field:
a) Right click the field in the Focus window.
b) Click New DRR.


a
b

<!-- page 217 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
216
EC17.0-PCD-01-A
Varian Confidential
c) The DRR Options dialog box opens.
d) Click Chest.dps.
e) Click Apply.
f)
Click Close.



c
d
e
f

<!-- page 218 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
217
EC17.0-PCD-01-A
Varian Confidential
g) For better viewing of the DRR, deselect the structures by removing the checkmark of
structure set CT_1.
h) If BEV is not open, click the BEV tab within the Model View .
i)
Set Beam’s Eye View to Field 1-RAO.
j)
Click Maximize view icon to expand view.




g
h
i
j

<!-- page 219 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
218
EC17.0-PCD-01-A
Varian Confidential
k) The DRR fully displays.
Note: The DRR is labeled the same as the Field it was created from. A DRR labeled (Live)
will be updated dynamically with the field geometry changes. A DRR labeled (Static) is
imported to the database and added as a field image to the plan. Static DRR’s do not
dynamically update. For more information refer to Eclipse Photon and Electron Reference
Guide, P1047679-001-Rev A.





l)
Click Save All icon.




l
k

<!-- page 220 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
219
EC17.0-PCD-01-A
Varian Confidential
Edit DRR
Once a DRR is created it can be edited.
Note: DRRs may be edited and DRR parameter sets can be saved for future use. The
system features predefined combinations of detailed calculation settings for the parameter
sets. These can be adjusted per patient to achieve the optimal DRR.


The system features predefined combinations of detailed calculation settings for the parameter sets
presented in the following table.  Reference: Eclipse Photon and Electron Reference Guide—P1047679-
001-A.

<!-- page 221 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
220
EC17.0-PCD-01-A
Varian Confidential
1) To edit a DRR:
a)  Right click on the DRR in Focus window.
b) Click Edit DRR.



b
a

<!-- page 222 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
221
EC17.0-PCD-01-A
Varian Confidential
c) The DRR Options - Edit DRR dialog box opens.
d) Uncheck the second and third check marks (under Parameters) to display the first
channel. For this example, the first channel is the air channel.
e) Uncheck Clipping (planes).
f)
Click Apply.



c
e
d
f

<!-- page 223 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
222
EC17.0-PCD-01-A
Varian Confidential
g) The DRR now displays only air.



h) Uncheck the first channel and check the second channel. For this example, the second
channel is the soft tissue channel.
i)
Uncheck Clipping planes.
j)
Click Apply.




h
i
j
g

<!-- page 224 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
223
EC17.0-PCD-01-A
Varian Confidential
k) The DRR now displays soft tissue.



l)
Uncheck second channel and check third channel. In this example, the third channel
represents the bone channel.
m) Click Apply.


k
m
l

<!-- page 225 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
224
EC17.0-PCD-01-A
Varian Confidential
n) The DRR now displays bone.



o) Select Chest.dps parameter set. The multi-channels and variable weights are turned on.
p) Click Apply.



n
o
p

<!-- page 226 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
225
EC17.0-PCD-01-A
Varian Confidential
q) The combined channels DRR displays.
r)
Minimize the DRR by clicking the Minimize icon.






q
r

<!-- page 227 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
226
EC17.0-PCD-01-A
Varian Confidential
s) Click the field in the Focus Window.
t)
Maximize the Transversal view.



s
t

<!-- page 228 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
227
EC17.0-PCD-01-A
Varian Confidential
2) Clipping planes allow the user to use all, or a portion of the patient data to calculate a channel of
the DRR.  For this example, we want to highlight the air in the trachea. Uncheck the clipping
planes for the soft tissue channel (second channel.)
a) Click in the Clipping plane box for the air channel.
b) The two pink lines are the clipping planes for the air channel.


a
b

<!-- page 229 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
228
EC17.0-PCD-01-A
Varian Confidential
c) The clipping planes may be moved by changing their ”From and To" parameters. For this
example, we would like the clipping planes to be in the general vicinity of the trachea.
Change the From to -4.0 and To 1.0 for this patient.
Note: This distance is measured from the isocenter.

d) Change the weight of the air channel to 1.
e) Click Apply.
f)
Minimize the Transversal view.


d
f
e
c

<!-- page 230 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
229
EC17.0-PCD-01-A
Varian Confidential
g) The updated DRR displays with the combined layers highlighting the trachea for this
particular patient.



g

<!-- page 231 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
230
EC17.0-PCD-01-A
Varian Confidential
3) Parameter sets may be saved
a) Click Save Set….
.


b) The Parameter Set Name dialog box opens.
c) Type unique set name. For this example, type Practice.
d) Click OK.



a
b
c
d

<!-- page 232 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
231
EC17.0-PCD-01-A
Varian Confidential
e) The default set is used when a field does not have a DRR and the system creates one
automatically during plan approval. For this example, select Chest.dps.
f)
Click Set as default.
g) Click Close.


4) Click Save All icon.



e
4
f
g

<!-- page 233 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
232
EC17.0-PCD-01-A
Varian Confidential
 Add an MLC to Field
Note: For more information refer to Eclipse Photon and Electron Instructions for Use
P1047678-002-B.

1) To add an MLC to the field:
a) Right click on the field.
b) Click New MLC.



b
a

<!-- page 234 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
233
EC17.0-PCD-01-A
Varian Confidential
c) The MLC appears in the Focus window. To fit MLC to structure, right click on the MLC.
d) Click  Fit to Structure.


c
d

<!-- page 235 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
234
EC17.0-PCD-01-A
Varian Confidential
e) Fit MLC to Structure dialog box opens.
f)
Select Target from the dropdown. For this example, select PTV Lung.
g) Select Circular margin with 0.80 cm.



f
g
e

<!-- page 236 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
235
EC17.0-PCD-01-A
Varian Confidential
h) Click  in the Optimize collimator jaws checkbox.
Note: Optimize collimator jaws –adjusts the collimator jaws to the best fit of the MLC leaves
to the structure. Use recommended jaw positions – adjusts the collimator jaw positions
along the MLC aperture with an additional margin. Optimize collimator rotation – adjusts the
collimator angle to best fit the MLC leaves to the structure.
i)
Click Fit.
j)
Click Close.


h
j
i

<!-- page 237 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
236
EC17.0-PCD-01-A
Varian Confidential
2) Click Save All icon.



2

<!-- page 238 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
237
EC17.0-PCD-01-A
Varian Confidential
3) MLC’s may be manually adjusted.
a) Click the field’s MLC.
b) Click the Select MLC Leaves tool.
c) In the BEV, select a leaf.  When it becomes green, move it with the mouse.
Note: Several leaves may be moved at once by selecting the Ctr or Shift keys on the
keyboard.

d) Use the Reload All tool to reset the MLC leaf as before.





b
a
c
d

<!-- page 239 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
238
EC17.0-PCD-01-A
Varian Confidential
e) To display them solid (leaves filled in), select the Solid Leaves tool.
f)
The leaves are now solid.


f
e

<!-- page 240 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
239
EC17.0-PCD-01-A
Varian Confidential
g) Deselect Solid Leaves tool.
h) To select all leaves, select Select all leaves tool.
i)
All leaves are selected and displayed green.







i
h
g

<!-- page 241 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
240
EC17.0-PCD-01-A
Varian Confidential
j)
To deselect leaves, select Deselect all leaves tool.
k) Select Lock/Unlock tool to toggle between locked and unlocked. When locked, the leaves
cannot be edited.
l)
Leaves are displayed in red when locked.


m) To manually draw a new aperture, select Shaping tool.



m
j
k
l

<!-- page 242 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
241
EC17.0-PCD-01-A
Varian Confidential
n) The MLC Fit Options (MLC) dialog box opens.


o) Using the mouse, draw the new shape. Tool closes automatically when the aperture is
completed and the MLC is reshaped.




n
o

<!-- page 243 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
242
EC17.0-PCD-01-A
Varian Confidential
4) Reload All tool will load all patient data to the last save.




a) Modified Objects Found message appears asking if you wish to discard all changes and
reload objects from the database.  For this example, click Discard.




a
4

<!-- page 244 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
243
EC17.0-PCD-01-A
Varian Confidential
Add an Opposing Field
1) You can add an opposing field. For more information refer to Eclipse Photon and Electron
Instructions for Use P1020503-002-B.
a) To add an opposing field, select Insert Menu.
b) Select New Opposing Field.




a
b

<!-- page 245 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
244
EC17.0-PCD-01-A
Varian Confidential
c) New field is created.  Right click on the field.
d) Select Properties.



c
d

<!-- page 246 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
245
EC17.0-PCD-01-A
Varian Confidential
e) Field Properties dialog box opens.
f)
Change ID and field name as needed. In this example, change ID to Field 2 – LPO  and
Name to LPO.
g) Click OK.


g
f
e

<!-- page 247 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
246
EC17.0-PCD-01-A
Varian Confidential
h) Field ID and name is now appropriately displayed.





h

<!-- page 248 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
247
EC17.0-PCD-01-A
Varian Confidential
Add a Wedge to Field 1-RAO
1) Wedges can also be added to fields.  For more information refer to Eclipse Photon and Electron
Instructions for Use P1020503-002-B.
a) To add a wedge, right click on Field 1-RAO.
b) Click Properties.




a
b

<!-- page 249 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
248
EC17.0-PCD-01-A
Varian Confidential
c) The Field Properties dialog box opens.
d) Select Accessories tab.
e) From the Slot 1 Int Mount ID drop-down, select W15OUT20.
f)
Click OK.





c
d
f
e

<!-- page 250 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
249
EC17.0-PCD-01-A
Varian Confidential
g) Wedge will appear in the Focus window, Frontal view, Sagittal view and the BEV.
Note: Wedges can be deleted by selecting the wedge in the focus window and pressing the
Delete key on the keyboard.







g

<!-- page 251 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
250
EC17.0-PCD-01-A
Varian Confidential
 Add a Bolus to Field 1-RAO
1) Bolus has to be created and then linked to a treatment field to be included in the calculation. For
more information refer to Eclipse Photon and Electron Instructions for Use P1047678-002-B.
a) To create a bolus, select Insert.
b) Select New Bolus…




b
a

<!-- page 252 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
251
EC17.0-PCD-01-A
Varian Confidential
c) The Bolus Properties dialog box opens.
d) Type the ID and Name of 5mm Bolus.
e) Click OK.



d
e
c

<!-- page 253 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
252
EC17.0-PCD-01-A
Varian Confidential
f)
The 5 mm Bolus icon appears in the Structure Set in the Focus window.
g) The Edit Bolus on Body tool opens.




g
f

<!-- page 254 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
253
EC17.0-PCD-01-A
Varian Confidential
h) Type 0.5 in the Thickness [cm] field,
i)
The pencil icon with the +
Adds the Part drawn with the mouse.
j)
The pencil icon with the -
Removes the part drawn with the mouse.
k) Clear removes the bolus.
l)
Adjust the slider bars to change the Transparency During Edit.

m) Click the Add button and draw the bolus with the mouse in the BEV closing the drawing at
the starting point.



h
i
j
k
l
m

<!-- page 255 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
254
EC17.0-PCD-01-A
Varian Confidential
n) The bolus displays.
o) Click Close.






n
o

<!-- page 256 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
255
EC17.0-PCD-01-A
Varian Confidential
p) Bolus is now created but must be linked to the fields.  Right click on the field Field 1 – RAO.
q) Select Link to Bolus 5 mm Bolus.



q
p

<!-- page 257 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
256
EC17.0-PCD-01-A
Varian Confidential
r)
Bolus is linked to the field in the Focus window and is visible in the BEV.
Note: To remove a bolus you must first unlink the bolus from the field then the bolus can be
deleted.




2) Click Save All.










2
r

<!-- page 258 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
257
EC17.0-PCD-01-A
Varian Confidential
Section 5: Setup Fields
Setup fields are fields that are utilized for imaging at the treatment unit utilizing MV, kV or CBCT.  This
assists in aligning the patient correctly for treatment. For more information refer to Eclipse Photon and
Electron Instructions for Use P1047678-002-B
Note: The type of image is defined in Plan Scheduling when the imaging sequence
template is applied to the setup field. C-Series machines require kV or CBCT sequence
templates to be applied in the Plan Scheduling application. TrueBeam machines allow for
sequence templates to be added at the machine.

 Setup fields are orthogonal fields, generally an AP or PA and a lateral.
Note: Customers who have the On Board Imager (OBI) on their treatment units generally
utilize a right lateral field as a Setup Field. It requires less gantry rotation to move the
accelerator from one field to another than it would if using a left lateral field.

 Setup Fields are created in the plan and do not contribute to the dose of the plan.
 DRRs may be attached to Setup Fields.
 Setup Fields are designated with the
  icon in the Focus window and blue beams in the
Graphics windows.
 Setup Fields do not contain any field add-ons (wedges, etc.).

These are removed automatically when the Setup Fields are created. However, after Plan
Approval, a field aperture may be added to Setup Field DRRs.
 Setup fields can be created from the original (treatment) fields in the External Beam Planning
application. The original field remains intact. The created setup field is an exact copy of the
original, excluding dose and Add-ons. (MLC’s will remain)

<!-- page 259 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
258
EC17.0-PCD-01-A
Varian Confidential
1) To create a setup field:
a) Select the Insert menu.
b) Select New Setup Field.





b
a

<!-- page 260 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
259
EC17.0-PCD-01-A
Varian Confidential
c) Set up field is created and nested below the Isocenter Group.




2) To change the name of the setup field:
a) Right click on Field 1.
b) Select Properties.



c
b
a

<!-- page 261 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
260
EC17.0-PCD-01-A
Varian Confidential
c)  The Setup Field Properties dialog box opens.
d) Select General tab.
e) Type AP kV-Setup in ID and Name.
Note: It is a good practice to label the setup field with “kV” or “CBCT” so the therapists can
easily identify the type of imaging.


d
e
c

<!-- page 262 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
261
EC17.0-PCD-01-A
Varian Confidential
f)
Select Geometry tab.
g) Type field size in the Field X and Field Y fields. Generally 10 x 10, 12 x 12, or 15 x 15.  For
this example, type 10.0 x 10.0.
h) Click OK.





g
f
h

<!-- page 263 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
262
EC17.0-PCD-01-A
Varian Confidential
3) To create the RT Lateral setup field:
a) Right click on AP kV-Setup.
b) Select Copy Field.




a
b

<!-- page 264 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
263
EC17.0-PCD-01-A
Varian Confidential
c) Right click on AP-Setup again.
d) Select Paste Field with Field Image(s).




c
d

<!-- page 265 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
264
EC17.0-PCD-01-A
Varian Confidential
e) The Setup Field Properties dialog box opens.
f)
Select General tab.
g) Type RT Lat-Setup  in the ID and  Name fields.



f
e
g

<!-- page 266 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
265
EC17.0-PCD-01-A
Varian Confidential
h) Select Geometry tab.
i)
Change the Gantry/Source Rtn to 270 deg.
j)
Click OK.


h
i
j

<!-- page 267 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
266
EC17.0-PCD-01-A
Varian Confidential
k) Right click on AP kV-Setup field.
l)
Select New DRR.

m) From the DRR Options dialog box, select Practice.dps.
n) Select Apply to all fields.
o) Click Apply.
p) Click Close.









l
k
m
o
n
p

<!-- page 268 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
267
EC17.0-PCD-01-A
Varian Confidential
q) The Setup Fields with DRRs display.





q

<!-- page 269 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
268
EC17.0-PCD-01-A
Varian Confidential
4) Select Save All.



4

<!-- page 270 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
269
EC17.0-PCD-01-A
Varian Confidential
Section 6:  AAA Dose Calculation and Field Normalization Options
The Calculation algorithm and calculation parameters can be modified in the Information Window. This
information can also be accessed and modified in the properties of the plan in the calculations models
tab. For more information refer to Eclipse Photon and Electron Instructions for Use P1047678-002-B.

1) Before starting the calculation:
a) Select Calculation Models tab in the Info Window.
b) Select the lower right corner of the Volume Dose calculation models dialog box.
c) Select desired algorithm for Volume Dose. For this example, select  AAA_17.0.1 (latest
version).
Note: If default algorithms are set in the Beam Configuration application, select Use
Default Models.




a
b
c

<!-- page 271 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
270
EC17.0-PCD-01-A
Varian Confidential
d)  Select  Edit to open the Calculations Options for the selected algorithm.



e)  The Calculations Options dialog box opens.
Note: AAA allows manual entry of a grid size ranging between 0.1-0.5 cm.
The grid defaults to covering the entire 3D Volume.
AAA does not account for structures/ heterogeneity outside the body outline, with the
exception of a support structure (couch) and bolus.  Refer to Eclipse Photon and Electron
Algorithms Reference Guide P1047677-001-A.

f)
Adjust Calculation resolution in CM as desired.  For this example, leave at 0.25.






d
e
f

<!-- page 272 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
271
EC17.0-PCD-01-A
Varian Confidential

g) Select the desired Heterogeneity correction from the dropdown.  For this example, select
ON.
Note: AAA Heterogeneity options are ON—calculating with heterogeneity correction, or
OFF—calculating without heterogeneity, assuming a homogeneous volume like a
Phantom.











g

<!-- page 273 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
272
EC17.0-PCD-01-A
Varian Confidential
h) Select the Field normalization type from the dropdown.
Note: For more information refer to Eclipse Photon and Electron Algorithms Reference
Guide, P1047677-001-A.
 100% to isocenter: The field will contribute the field weight x 100% to the isocenter. If
this is selected, 100% will be prescribed to the isocenter of the plan if the sum of the
field weights is equal to 1.0.
 100% to field central axis Dmax: The weighting point is moved to a depth of Dmax at
the CAX. The field contributes field weight x 100% to Dmax.
 100% to field Dmax: the Dmax point is the weighting point. Field contributes field
weight x 100% to Dmax.
 No field normalization: Fields normalized according to machine absolute calibration. A
field weight of 1 results in 100% dose at the calibration point in the calibration
geometry.

i)
Click Cancel (because no changes were made, OK is not available.)





i
h

<!-- page 274 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
273
EC17.0-PCD-01-A
Varian Confidential
2) The maximum size of the calculation volume depends on the algorithm selected and the
calculation grid size that has been defined for that algorithm. The smaller the calculation grid size,
the smaller the allowed maximum size of the calculation volume.
a) To resize the calculation volume, click on the Show/Edit Calculation Volume tool.
b) The calculation volume is displayed.
c) Use the corner of boxes on any view to resize.






a
c
b

<!-- page 275 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
274
EC17.0-PCD-01-A
Varian Confidential
d) The resized volume can be reset by clicking the Reset Calculation Volume tool. For this
example, reset the calculation volume.
Note: Be sure that the Calculation Volume covers the entire area of interest or patient to
avoid doses and/or DVHs from being truncated.

e) Click Fields tab.



e
d

<!-- page 276 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
275
EC17.0-PCD-01-A
Varian Confidential
3) In order to receive 100% at Field Isocenter, AAA expects that all field weights add up to 1.0.
However the field weights default to 1.0 each.



a)  Change the beam weights so the total adds to 1.0.  For this two field example, 0.50 each.
Note: Field weights can be adjusted as desired for the appropriate dose distribution.
However, ensure that the sum of all beam weights add up to 1 in order to display 100% at
the isocenter.



4) Plan is ready to calculate.
a) To perform a 3D calculation, select the Calculate Volume tool





3
a
a

<!-- page 277 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
276
EC17.0-PCD-01-A
Varian Confidential
b) The Select Imaging Device dialog box may open if the default imaging device was not
configured.
Note: The system requires a default CT scanner. It is the responsibility of the system
administrator to set this default.

c) If it appears, click OK.





b
c

<!-- page 278 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
277
EC17.0-PCD-01-A
Varian Confidential
d) The Calculation Progress dialog box opens.
e) Place a checkmark in the Close after successful calculation to have the box close when
calculation is complete.




f)
Plan is now calculated and isodose lines can be reviewed.



e
f
d

<!-- page 279 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
278
EC17.0-PCD-01-A
Varian Confidential
5) It may be necessary to adjust field weights after the calculation is completed.
a) Select Planning.
b) Select Field Weight… (Pressing F3 on the keyboard will open the tool as well).


c) The Field Weights for Plan dialog box opens.
d) A checkmark in the Interactive apply checkbox is selected by default so as you make field
weight changes they will appear immediately.




a
b
d
c

<!-- page 280 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
279
EC17.0-PCD-01-A
Varian Confidential
e) Use the sliders or type a value to adjust the field weights.
f)
When finished, click Close.





g) Click the Fields tab in Info window.
h) Review the Monitor Units (MU).





f
g
h
e

<!-- page 281 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
280
EC17.0-PCD-01-A
Varian Confidential
6) Plan normalization options are available to rescale the dose display in the plan. For more
information refer to Eclipse Photon and Electron Algorithms Reference Guide, P1047677-001-A
a) Select Planning.
b) Select Plan Normalization…
Note: Alternatively, clicking the Plan Normalization button under the Dose Prescription tab
will open the tool.








a
b

<!-- page 282 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
281
EC17.0-PCD-01-A
Varian Confidential

Note: Target Maximum, Target Mean, Target Minimum, and ___% of Target refer to the
structure selected as the target of the plan in Plan properties. The target volume can be
changed within Plan properties if needed.



Note: Plan Normalization Value: The plan is normalized according to the user-defined value
entered in the text box. For more information refer to Eclipse Photon and Electron
Reference Guide, P1047679-001-A.


Note: Always verify the plan is normalized as desired.

<!-- page 283 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
282
EC17.0-PCD-01-A
Varian Confidential
c) The Plan Normalization dialog box opens.
d) Select desired normalization. For this example, select 100% at Field Isocenter, Field 1-
RAO.
e) Click OK.


c
d
e

<!-- page 284 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
283
EC17.0-PCD-01-A
Varian Confidential
7) The system can be set up to have a default normalization method which will automatically
normalize each plan to the selected option.
a) To set the default plan normalization select Tools.
b) Select Task Configuration…



a
b

<!-- page 285 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
284
EC17.0-PCD-01-A
Varian Confidential

c) The Task Configuration dialog box opens.
d) Select Default Plan Normalization Mode tab.
e) Select the default normalization mode.
f)
Click OK.




c
d
f
e

<!-- page 286 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
285
EC17.0-PCD-01-A
Varian Confidential

8)  To prescribe to an isodose line which updates the monitor units and absolute dose display only:
a) Select Dose tab in the Info window.
b) Enter the prescribed percentage in the Treatment Percentage column. For this example,
enter 95.
Note: This method updates the monitor units and absolute dose. The relative dose display
does not change.






c) Click the Fields tab.
d) Review the MUs.







a
b
c
d

<!-- page 287 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
286
EC17.0-PCD-01-A
Varian Confidential
9) To Scale the monitor units, absolute and relative isodose display, renormalization of the plan is
necessary. The existing plan normalization must be scaled by the desired percentage.
a)  For this example, first go to the Dose tab and return the Prescribed Percentage to 100.



b) Select Planning from Menu bar.
c) Select Plan Normalization…


b
c
a

<!-- page 288 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
287
EC17.0-PCD-01-A
Varian Confidential
d) Plan Normalization dialog box opens.
e) The plan is normalized to 100% at Field Isocenter and Plan Normalization Value is 100%.



e
d

<!-- page 289 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
288
EC17.0-PCD-01-A
Varian Confidential
f)
To scale the plan to the 95%, enter 95 in the Plan Normalization Value.
g) Click OK.







g
f

<!-- page 290 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
289
EC17.0-PCD-01-A
Varian Confidential
h) Info window’s Plan Normalization Mode displays the normalization value of 95%.





i)
Select the Fields tab.
j)
Verify the MUs have scaled correctly.





h
j
i

<!-- page 291 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
290
EC17.0-PCD-01-A
Varian Confidential
k) Isodose lines have been scaled also.
l)
Continue working on your plan to find an acceptable dose distribution.
Important Note: Do not use both methods on the same plan. The dose will be scaled twice.










k

<!-- page 292 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
291
EC17.0-PCD-01-A
Varian Confidential
 Section 7:  Acuros XB Dose Calculation and Field Normalization
General Information Regarding the Acuros XB Algorithm.  For more information refer to Eclipse Photon
and Electron Algorithms Reference Guide P1047677-001-A.

 This is a purchasable algorithm for photon dose calculations.
 In external photon beam radiotherapy, heterogeneities may significantly influence the dose
distribution in the patient, especially in the presence of small or irregular fields. Acuros XB directly
accounts for the effects of these heterogeneities.
 Acuros XB uses a materials table in the calculation. This table is assigned to the structure set
upon import. Physical Materials tables are defined in RT Administration. The table is used by
Acuros XB dose calculation algorithm (photon planning) and the Segment High Density tool.
When a table has been assigned to a structure set, Acuros XB automatically assigns biological
material to the CT image as per the materials table. Any density that is higher than 3 g/cm3 must
be assigned a material. Densities higher than 3 g/cm3 can be automatically detected using the
Segment High Density artifact tool. Once these high-density segments have been defined, they
can be assigned a material. If no physical material is defined, the Segment High Density artifacts
tool considers all densities higher than 3 g/cm3 as high densities. For more information on the
Acuros XB dose calculation algorithm, refer to Eclipse Photon and Electron Algorithm Reference
Guide.
 Acuros XB does not account for structures/ heterogeneity outside the body outline, except for a
support structure (couch).

<!-- page 293 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
292
EC17.0-PCD-01-A
Varian Confidential
1) You can set a default materials table to be assigned to a patient upon import of images in RT
Administration based on user rights. To assign a default table:
a) Click QuickLinks.
b) Select Administration.
c) Click RT Administration.




a
b
c

<!-- page 294 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
293
EC17.0-PCD-01-A
Varian Confidential
d) Click Continue when Entering RT Administration information box opens.


d

<!-- page 295 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
294
EC17.0-PCD-01-A
Varian Confidential
e) Select Clinical Data workspace.
f)
Select Physical Materials tab.
g) From the Table ID drop down, select the appropriate table version to match the algorithm
version your department is using. For this example, select AcurosXB-13.5.
h) Click Set as Default.


h
e
f
g

<!-- page 296 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
295
EC17.0-PCD-01-A
Varian Confidential
2) Navigate back to External Beam Planning using the Back arrow.


a) Select Calculation Model tab in the Info window.
b) Select AXB_17.0.1 (or latest) from the Calculation Model dropdown.



c) A Warning opens stating that the calculated plan will be invalidated. Click Yes.




2
c
a
b

<!-- page 297 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
296
EC17.0-PCD-01-A
Varian Confidential
3) A Physical Material Table may need to be assigned to the Structure Set.
a) Right click on the Structure Set (in this example CT_1) in the Info window.
b) Select Properties.



b
a

<!-- page 298 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
297
EC17.0-PCD-01-A
Varian Confidential
c) Structure Set Properties dialog box opens.
d) Click the Physical Material Table dropdown on the General tab.
e) Select AcurosXB-13.5.
f)
Click OK.


d
c
e
f

<!-- page 299 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
298
EC17.0-PCD-01-A
Varian Confidential
When a material is not automatically assigned, the user must manually assign one.
g) To do this, first clear the 3D dose calculation from the plan. Click Reset Calculation Volume
from the tool bar.

h) Right click on structure in Focus window. For this example, select CORD.
i)
Select Properties.



i
h
g

<!-- page 300 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
299
EC17.0-PCD-01-A
Varian Confidential
j)
Select CT Value and Material tab.
k) Place checkmarks in the Assign CT Value and Assign Material checkboxes.
l)
Select the material from the drop-down.
m) For this example, click Cancel.
Important Note: Assigning HU only, may be helpful if the density is a result of artifact
from another high density. For example; artifact from dental work or a hip prosthesis.
Assigning HU and material may be helpful. For example you may want to assign HU and
material to the actual hip prosthesis or prostate fiducials.
You must assign a material and CT value to anything in the 3D image that has density
higher than 3g/cc. Assigning only a HU without material type for any non-biological structure
will prevent Acuros from calculating.


k
l
m
j

<!-- page 301 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
300
EC17.0-PCD-01-A
Varian Confidential

4) The algorithm parameters can be modified in the Info Window. For more information Refer to
Eclipse Photon and Electron Algorithm Reference Guide P1047677-001-A.
a) Click Edit.



b) The Calculation Options dialog box opens.
c) Set the desired Calculation resolution in CM.  For this example, leave at 0.25.
d) The minimum and maximum grid size value ranges from Minimum 0.1 cm to maximum 0.3
cm.
Note: The selected Calculation grid size in CM you define used within the beam geometry.
Regardless of the output grid size Acuros XB will account for the effects of photon and
electron transport the full CT volume. The calculation grid becomes larger outside of the
beams.





a
b
c
d

<!-- page 302 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
301
EC17.0-PCD-01-A
Varian Confidential
e) Field normalization type is the same for AAA and Acuros XB. To select the type, click the
drop down arrow in the Field normalization type field.
f)
From the menu, select the normalization type, for this example select 100% to isocenter.



e
f

<!-- page 303 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
302
EC17.0-PCD-01-A
Varian Confidential
g) Dose reporting mode will display on the image after calculation. To select the mode, click
the dropdown arrow in the Dose Reporting Mode field.
h) From the menu, select the appropriate mode. For this example, select Dose to Medium.
Note: Dose to water: Transports in medium and deposits dose to water. It is used mostly for
physics measurements or research.




g
h

<!-- page 304 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
303
EC17.0-PCD-01-A
Varian Confidential
i)
Heterogeneity correction for Acuros XB options include ON (calculating with heterogeneity
correction) or OFF (transport in water). To select the correction option, click the drop down
arrow in the Heterogeneity correction field.
j)
From the menu, select the desired option. For this example, select ON.



i
j

<!-- page 305 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
304
EC17.0-PCD-01-A
Varian Confidential
5) You can select the Plan dose calculation option by clicking the drop-down arrow in the Plan
dose calculation field. For more information Refer to Eclipse Photon and Electron Algorithm
Reference Guide P1047677-001-A.

Note: ON
 Calculates all of the fields (or Control Points) as a single job. Fast calculations for
multi-field plans (RapidArc or many IMRT fields) as multiple fields take the same time
to calculate as one field.
 This option does not report dose per field, dose to reference point per field and does
not allow the user to change weights after calculation.
 Helpful option with IMRT and RapidArc plans as the dose per field and field weighting
are not commonly used.
When using this option with conformal plans, the system will warn the user.

Note: OFF
 Each field or calculation point will be calculated separately. The calculation for each
field will take almost as long as for the option above for all fields.
 This option will report dose per field, dose per field to reference points and allow the
user to change weights as the dose contribution from each field is calculated.
Helpful option with conformal plans as it allows the user to change weights and reports
dose per field as well as dose per field to each reference point.

<!-- page 306 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
305
EC17.0-PCD-01-A
Varian Confidential

a) From the menu select the desired option.  For this example, select ON.





a

<!-- page 307 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
306
EC17.0-PCD-01-A
Varian Confidential
b) Automatic high density material options are set in Beam Configuration and cannot be
edited during planning.
c) This option allows the system to automatically assign a material to small volumes of densities
greater than 3g/cm3 for example water or bone. In this example Bone has been defined as
the default material in Beam Configuration.





b
c

<!-- page 308 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
307
EC17.0-PCD-01-A
Varian Confidential
d) The Maximum automatic high density volume in CM3 is also defined in Beam
Configuration and cannot be modified during planning.
e) This option defines the maximum volume that the system is allowed to assign a high density
material automatically. For example, in the Automatic high density material option if bone
is assigned as the default to densities greater than 3g/cm3 the Maximum automatic high
density volume in CM3 will limit the volume size assigned automatically as per the value
defined in Beam Configuration.
f)
Click Cancel  to close calculation options.





d
e
f

<!-- page 309 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
308
EC17.0-PCD-01-A
Varian Confidential
 Section 8:  Reference Points and Dose Prescription Volumes
General Information
A Reference Point has a physical location.
 This may be defined in the Reference Point Properties dialog box or it may be moved manually
with the mouse.
 When the reference point is selected in the Focus window, its location appears in the Graphic
display.
 A treatment plan may be normalized to a physical reference point; such as when treating to a
depth.
 A reference point may be the Primary Reference Point for a treatment plan.
 Reference Points reside in the Reference Points folder and may be attached to any plan.

The purpose of the Dose Prescription Volume (DPV) is to track the Prescription Dose in the
Record and Verify system.
 The DPV tracks dose to the Prescription Volume, therefore it has no specific physical location.
The location tab in the Reference Points Properties dialog box is not present.



Note: Instead of tracking a specific point inside the patient which may be getting slightly
more or less dose than the prescription due to the dose distribution or normalization, the
DPV simply tracks the prescribed dose to the prescribed volume.


 A separate DPV is necessary for each prescription. DPVs are automatically created when
inserting a new plan and automatically uses the label of the target volume you chose during plan
creation.
 DPV points can be manually created in Eclipse.
 Any reference point created in ARIA (as in the Reference Points Workspace) is also a DPV.
 DPVs reside in the Reference Points folder and may be attached to any plan.

<!-- page 310 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
309
EC17.0-PCD-01-A
Varian Confidential
A plan cannot be normalized to a DPV.

Note: For more information about Reference Points with and without location refer to
Eclipse Photon and Electron Instructions for Use, P1047678-002-B.

 This dose tracking volume can be used by ARIA, VARiS or IMPAC customers to easily track the
prescribed dose.

1) To determine if a reference point is a DPV:
a) Right click on the reference point PTV Lung in the Focus window.
b) Select Properties.




a
b

<!-- page 311 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
310
EC17.0-PCD-01-A
Varian Confidential
c) The Reference Point Properties dialog box opens.
d) There will be no tab labeled ‘Location’ for the DPV.
e) Click Cancel.




c
d
e

<!-- page 312 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
311
EC17.0-PCD-01-A
Varian Confidential
2)  To create a reference point with a location:
Note: 3rd party monitor unit checking programs will generally need a point with a location
and saved as the Primary point to calculate to; the following explains how to create an
isocenter point.

a) Right click on the Reference Points folder in Focus window.
b) Select New Reference Point and Location.



a
b

<!-- page 313 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
312
EC17.0-PCD-01-A
Varian Confidential
c) The Reference Point Properties dialog box opens.
d) Enter ISOCENTER in the ID field on General tab.
e) Select Target as the Type.
f)
Enter Dose Limits as shown.



e
c
f
d

<!-- page 314 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
313
EC17.0-PCD-01-A
Varian Confidential

g) Click the Location tab.

Note: Eclipse places the point within the 3D image. The X, Y, Z coordinates are displayed.
The point’s location can be adjusted by typing the coordinates here or it can be moved
manually with the Edit Reference Points tool.

h) Click OK.













h
g

<!-- page 315 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
314
EC17.0-PCD-01-A
Varian Confidential
i)
 To relocate this point to the isocenter, right click on the reference point ISOCENTER.
j)
Select Move Reference Point to Isocenter.



k) Reference point is now at the field isocenter location.




k
i
j

<!-- page 316 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
315
EC17.0-PCD-01-A
Varian Confidential
3) Manual DPV creation may be required when a plan is imported from a CT simulator or a 3rd party
system. It may also be utilized when additional DPVs are needed; for examples: when a boost
plan is created by copying and pasting the original plan; a new Boost DPV is needed; or if a plan
contains multiple target volumes all to be treated every day but to different daily doses.
a) Right click on the Reference Points folder.
b) Select New Reference Point and Location.


c) Enter the ID as DPV on General tab of Reference Properties dialog box.
d) Select the Type as Target.
e) Click OK.





b
e
c
a
d

<!-- page 317 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
316
EC17.0-PCD-01-A
Varian Confidential
f)
Right click on the new DPV reference point.
g) Click Delete.


h) The Delete Reference Point dialog box opens. You are asked how to modify the Reference
Point.
Note: If you click “Delete location from image current CT”, only the location is eliminated;
creating a new DPV.
If you click “Delete the reference point from patient___”, the reference point will be
deleted from the patient.

i)
Select Delete location from image “CT_1’.





f
g
h
i

<!-- page 318 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
317
EC17.0-PCD-01-A
Varian Confidential
j)
Right click on the new DPV reference point.
k) Select Properties.


l)
The Location tab has been removed from the Reference Point Properties dialog box.
m) Click OK.


l
k
j
m

<!-- page 319 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
318
EC17.0-PCD-01-A
Varian Confidential
4) The point selected as the primary reference point will be the point sent to the Record and Verify
system to track the dose contributions from each field. The primary reference point must be
defined for MU calculation. It transfers MU to other ARIA applications. Using the DPV as the
primary reference point will ensure that all field doses will sum to the Prescription Dose,
regardless of the normalization option or the percent isodose line used.
a) To change the Primary reference point, click Dose tab in the Info window.
b) Click the desired ID (primary reference point). For this example, select PTV Lung.



5) The Reference Point Organizer provides an easy location for the user to associate or
disassociate point(s) to a plan. Reference points are attached to the patient and 3D image,
meaning that a single point can be created and used within multiple plans to track dose to a
particular point. When a point is in the plan, it will be visible in the Focus window. If the plan is
sent to the Record and Verify system, the point will be associated to the plan and dose will be
tracked to the point. Disassociated points will not appear in the Focus window or track dose from
the plan in the Record and Verify system.
a) Right click on the Reference Points folder.
b) Select Reference Point Organizer… in the Focus window.



a
a
b
b

<!-- page 320 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
319
EC17.0-PCD-01-A
Varian Confidential
c) The References Point in Plan dialog box opens.
Note: Points in the Reference Points box (located on the left) are points attached to the
patient but not associated to the current plan.
Points in the Reference Points in Plan box (located on the right) are associated to the
current plan.

d) Click reference points to add or remove from the plan (using the Remove or Add buttons.)
e) A reference point may also be designated as Primary by clicking Set Primary. Primary
reference point is designated by the green icon.
f)
Click Close.







c
d
e
f

<!-- page 321 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
320
EC17.0-PCD-01-A
Varian Confidential
Section 9:  Plan Approval and Delta Couch Shift
General Information:
All plans must first be Plan Approved and then Treatment Approved before those plans may be treated.
This is mandatory when using ARIA. For more information of Plan Approval and Delta Couch Shift refer to
Eclipse Photon and Electron Instructions for Use, P1047678-002-B.
Eclipse has a Couch “Shift sheet” option for the Plan printout.
Delta Couch Editor may be used to designate the Couch shift necessary for patient set-up.
 This is available in Eclipse, even if the Delta Couch Shift option was not purchased for the
treatment unit.
 To see the Delta Couch Shift during Plan Approval, it must be selected in RT Administration.
The Delta Couch Shift Editor may be selected at any time from the Planning Menu in External Beam
Planning.
Before starting Plan Approval process, all plan parameters should be verified.

1) To approve a plan with Delta Couch shift:
a) Right click on plan Rt Lung.
b) Select Plan Approval.
c) Select Planning Approved.


c
b
a

<!-- page 322 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
321
EC17.0-PCD-01-A
Varian Confidential
2)  The Planning Approval – Warnings and Errors dialog box opens.
Note: Read all Warnings and Errors.  Errors MUST be cleared before planning approval
is allowed. Warnings do not have to be cleared

a) Click Next >.






a
2

<!-- page 323 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
322
EC17.0-PCD-01-A
Varian Confidential
b) The Planning Approval – Dose Summary dialog box opens.
c) Review dose summary.  RT Prescription, if attached to the plan, should be checked against
the actual plan prescription. 3D dose statistics can also be reviewed here as a final check.
Click Next >.





c
b

<!-- page 324 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
323
EC17.0-PCD-01-A
Varian Confidential
d) If the Delta Couch Shift Editor in Plan Approval has been selected in RT Administration,
the Plan Approval-Delta Couch Shifts dialog box opens.
e) To use the couch shift values calculated by Eclipse, click Use values calculated from user
origin.



f)
 Acknowledge the information dialog box.  Click Yes.


d
e
f

<!-- page 325 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
324
EC17.0-PCD-01-A
Varian Confidential
g)  Values appear in the dialog box.
h) Click Next >.
Note: If you do not want to use the calculated values, you have 2 choices. 1. You may use
the Clear button and then select the Next button to continue. You will be able to continue
with the Plan Approval, however, there will not be a Couch Shift Sheet available with the
Plan Printout. 2. You cannot type values in this dialog box. If you wish to type values in the
boxes, use the Cancel button; select Delta Couch Shift Editor from Planning menu and type
necessary shifts.






h
g

<!-- page 326 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
325
EC17.0-PCD-01-A
Varian Confidential


i)
The Planning Approval – Parameters dialog box opens.
j)
Place a checkmark in the Structure outlines in reference images. Structures outlines
added here are attached to the reference images for visibility in Offline Review for matching.
For this example, check Body, Cord and PTV Lung.
k) Place a checkmark in the Generate DRRs to fields checkbox.
Note: This option will create a DRR image for each field that does not already have one.
The system will not overwrite existing DRRs. The default DRR template will be used to
create the DRRs.

l)
The actual SSD can be defined for each of the fields in the Planned SSD cell.
Note: Planned and Actual SSDs should match but may be adjusted if necessary due to
addition of bolus or how it may read at a positioning device, etc.






i
k
l
j

<!-- page 327 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
326
EC17.0-PCD-01-A
Varian Confidential
m) Place a checkmark in the Calculate Treatment times checkbox.

Note: The treatment time of a plan is calculated from the MUs and the dose rate of the
plan, using a treatment time factor:
Treatment Time = Treatment Time Factor x MU/dose rate
The range of the factor is 1.00 to 5.00

n) Enter a value in the Multiply with factor field. For this example, enter 1.5.
o) Click Finish.




n
m
o

<!-- page 328 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
327
EC17.0-PCD-01-A
Varian Confidential
p) The Approval in External Beam Planning dialog box opens.
q) Type User Name and Password.
r)
Click Authorize.
Note: When using ARIA, Plan Approval is mandatory and enforced for any plans generated
in Eclipse. Treatment Approval cannot be completed without prior Plan Approval.




s)  Status of plan Rt Lung is now Planning Approved.



q
r
p
s

<!-- page 329 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
328
EC17.0-PCD-01-A
Varian Confidential
3) To view couch shifts in print report:
a) Select File menu.
b) Click Print.
c) Click Report.




b
c
a

<!-- page 330 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
329
EC17.0-PCD-01-A
Varian Confidential
d) The Print Treatment Report dialog box opens.
e) Click the appropriate Printer from dropdown.
f)
Click Full.tml from the Layout dropdown.
g) Click Preview.




d
g
f
e

<!-- page 331 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
330
EC17.0-PCD-01-A
Varian Confidential
h) Treatment Plan Report opens.
i)
Couch Shifts might be on page 2.
j)
Click Close button (do not click the X in upper right corner or the Plan will close!)











h
i
j

<!-- page 332 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
331
EC17.0-PCD-01-A
Varian Confidential
Section 10: Create Templates
General Information
Templates are collections of structures, objectives and plan properties that can be saved. These may be
used to automatically create new objects within the plan. For more information of Plan Approval and Delta
Couch Shift refer to Eclipse Photon and Electron Instructions for Use, P1047678-002-B.
The planning process is simplified, because there is no need to create items and define properties on
individual plans.
Eclipse provides structure templates, objective templates and plan templates.
Templates can be created from objects existing in a plan or may be created from scratch.
 Structure templates can be created from an existing structure set attached to a patient or
manually from inside the Template Manager within the External Beam Planning Workspace, only.
 Objective templates are created from existing objectives within a plan and can be edited.
 Plan templates are created from existing plan(s).
 Templates are saved as XML files so they can be easily imported, exported and previewed.

<!-- page 333 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
332
EC17.0-PCD-01-A
Varian Confidential
1) To create a structure template from structures within a plan navigate to External Beam Planning.
a) Click Planning menu.
b) Select Templates and Clinical Protocols.
c) Select Create Structure Template From Structure Set.




a
b
c

<!-- page 334 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
333
EC17.0-PCD-01-A
Varian Confidential
d) The Structure Template Group Properties dialog box opens.
e) Enter an ID.  For this example enter Lung New.
f)
Click OK.




d
e
f

<!-- page 335 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
334
EC17.0-PCD-01-A
Varian Confidential
2) To view the structure template:
a) Select Planning.
b) Select Templates and Clinical Protocols.
c) Select Structure Template Manager…




a
b
c

<!-- page 336 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
335
EC17.0-PCD-01-A
Varian Confidential
d) The Structure Template Manager dialog box opens.
e) Select the drop-down arrow next to Approved.
f)
Select All.



d
f
e

<!-- page 337 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
336
EC17.0-PCD-01-A
Varian Confidential
g) Using scroll bar, locate the newly created Lung New template.
h) Select the new template Lung New.
i)
Click Preview.




g
h
i

<!-- page 338 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
337
EC17.0-PCD-01-A
Varian Confidential
j)
Preview of new template.
k) Close preview with X.






j
k

<!-- page 339 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
338
EC17.0-PCD-01-A
Varian Confidential
l)
 Click Close.
Note: Structure templates can be also created manually in the Structure template manger.
After creating the template, each structure has to be added. Most users find it easier to
create them from an existing plan.







l

<!-- page 340 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
339
EC17.0-PCD-01-A
Varian Confidential
3) A plan template can be created from an existing plan.
a) Select Planning.
b) Select Templates and Clinical Protocols.
c)  Select Create Plan Template From Plan…





a
b
c

<!-- page 341 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
340
EC17.0-PCD-01-A
Varian Confidential
d) The Create Plan Template – Identify the new plan template dialog box opens.
e) Rename template to Rt Lung.
f)
Click Next >.


g)  The Create Plan Template – Select plan template contents dialog box opens.
h) The items in the template can be decided here. For this example, select Include MLCs,
Include tolerance table information and Include custom DVH metrics.
i)
Click Next >.


e
f
h
g
i
d

<!-- page 342 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
341
EC17.0-PCD-01-A
Varian Confidential
j)
The Create Plan Template – Review plan item placement dialog box opens.
k) Click Finish.






j
k

<!-- page 343 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
342
EC17.0-PCD-01-A
Varian Confidential
4) To add a Plan from a Plan Template:
a) Select Insert.
b) Select New Plan from Template…



a
b

<!-- page 344 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
343
EC17.0-PCD-01-A
Varian Confidential

c) The Plan Template Selection dialog box opens.
d) Click All from the drop-down next to Approved.
e) Select the Plan Template you want from the list.
f)
Click Next >.






f
d
c
e

<!-- page 345 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
344
EC17.0-PCD-01-A
Varian Confidential

g) Click the Course1 (alternatively, a New Course may be created.)
h) Click Next >.






h
g

<!-- page 346 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
345
EC17.0-PCD-01-A
Varian Confidential
i)
The Create Plan from Template – Confirm treatment unit selection dialog box opens.
j)
Confirm or change the treatment unit. For this example, leave the plan on the iX 1100.
k) Click Next >.


l)
The Create plan from Template – Review prescription parameters dialog box opens.
m) Enter 25 fractions at 200 cGy per Fraction.
n) Click Next >.




j
l
m
n
k
i

<!-- page 347 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
346
EC17.0-PCD-01-A
Varian Confidential
o) The Select Plan Target Structure dialog box opens.
p) Select PTV Lung.
q) Click Next >.


r)
Create Plan from Template – Select Primary Reference Point dialog box opens.
s) Click Next >.




o
p
r
s
q

<!-- page 348 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
347
EC17.0-PCD-01-A
Varian Confidential

t)
The Create Plan from Template – Review matching with current patient model dialog
box opens.
u) Review and click Next >.


v)  The Create Plan from Template - Select Treatment Orientation dialog box opens.
w)  Select Head First – Supine.
x) Click Next >.


v
u
t
w
x

<!-- page 349 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
348
EC17.0-PCD-01-A
Varian Confidential
y) The Create Plan from Template – Review matched template parameters dialog box
opens.
z) After review, click Finish.






y
z

<!-- page 350 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
349
EC17.0-PCD-01-A
Varian Confidential
aa)  The new plan is created and available for planning.







aa

<!-- page 351 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
350
EC17.0-PCD-01-A
Varian Confidential
Section 11:  Revisions to Plans
General Information
If dosimetric changes are necessary to a plan after it has been imaged or treated, it is most convenient to
make those changes in Eclipse. For more information on plan revisions refer to Eclipse Photon and
Electron Reference Guide, P1047679-001-A.
There are two ways to make revisions to a plan in Eclipse:
 Create a Plan Revision. This creates a new unapproved plan. The original plan is Retired. The Plan
Revision is scheduled automatically.
 Copy and Paste the original plan, creating a new unapproved plan. This allows for the original plan to
continue being treated while the new unapproved copied plan is revised.

1) There may be instances where a plan has been delivered or imaged and the physician wants to
make changes. In this instance the best practice would be to create a plan revision in Eclipse.
a) Navigate to External Beam Planning and open patient: US-EC-2005, EC OPS, FOR PLAN
CHANGES.


a

<!-- page 352 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
351
EC17.0-PCD-01-A
Varian Confidential
b) The Object Explorer dialog box opens.
c) Click Plan Changes course.
d) Click OK.




b
c
d

<!-- page 353 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
352
EC17.0-PCD-01-A
Varian Confidential
e)  Select the Dose tab in the Info Window.
f)
Note the number of fractions and total dose.



e
f

<!-- page 354 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
353
EC17.0-PCD-01-A
Varian Confidential
g) For this example, the For Changes plan has been delivered one time and changes are
needed.
h) Right click on For Changes plan in Focus window.
i)
Select Create Plan Revision.




h
i

<!-- page 355 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
354
EC17.0-PCD-01-A
Varian Confidential
j)
A message will open stating that the revised plan will be Unapproved and explains about
DRR layers. Click Yes.


k) The original plan For Changes is Retired indicated by the greyed out icon.
Note: A Retired plan cannot be accessed for treatment. It may be copied and pasted if
necessary. The copied/pasted plan may be manipulated.





l)
The newly created plan revision, For Changes:1 is designated with a :1 and is Unapproved.




j
k
l

<!-- page 356 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
355
EC17.0-PCD-01-A
Varian Confidential
m) Click the Dose tab.
n) The fractions and dose are automatically updated indicating 9 of the original 10 fractions and
1800 cGy of the original 2000 cGy total dose remain. Parameters in this plan, i.e. field size,
beam angle, etc. are available for changes and recalculation per departmental protocol.


Note: The plan may be planning and treatment approved in Eclipse. It is not necessary to
return to Plan Scheduling as once the plan has been scheduled, treated or imaged the
scheduling is adjusted automatically.






m
n

<!-- page 357 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
356
EC17.0-PCD-01-A
Varian Confidential
There may be instances when the original plan is still in use and you want to create a boost plan based off
the original plan. In this case you could use the copy/paste method allowing the original plan to continue
to be treated while you work on the boost plan.

2) To create a copy/paste plan:
a) Drag the plan For COPY into view. Right click on the plan.
b) Select Copy Plan.


c) Right  click on the Course Plan Changes.
d) Select Paste Plan.



b
a
d
c

<!-- page 358 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
357
EC17.0-PCD-01-A
Varian Confidential
e) The Plan Properties dialog box opens.
f)
The plan ID automatically becomes For COPY1. For this example, rename it Boost.
g) Click OK.





g
e
f

<!-- page 359 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
358
EC17.0-PCD-01-A
Varian Confidential
h) A message may appear stating the the plan does not have any isodose levels defined.
i)
Click Yes to apply the default isodose level template.

j)
A message will open stating that the newly revised plan will be Unapproved and explains
about DRR layers. Click Yes.





















j
h

<!-- page 360 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
359
EC17.0-PCD-01-A
Varian Confidential
k) Copied plan Boost is now available for editing. Make necessary changes, recalculate,
planning approve and schedule plan as appropriate.
Note: The original plan is still available for treatment. If you would like to discontinue
treating the original plan, it would be necessary to manually complete it to stop treatment.













k

<!-- page 361 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
360
EC17.0-PCD-01-A
Varian Confidential
Section 12:  Field Alignment
1) For this exercise, open patient US-EC-2007, EIPOPS, BREAST PATIENT in External Beam
Planning.
3) This patient has a course, “FLD ALIGNMENT”, in which 3 fields have been created: SCLAV with
a reference point at 3cm depth; and OPPOSED TANGS with a reference breast calculation point.
4) Open the FLD ALIGNMENT course from the Object Explorer.

Field Alignment Concepts
The Field Alignment tool allows the user to define that certain planes of two fields are always aligned with
each other.
Field planes are aligned with each other to achieve a uniform dose distribution over large volumes.
The fields are not matching in a specified location within the patient.
If a field that is included in a Field Alignment rule is moved, the gantry, collimator, couch rotations, field
sizes and even the isocenter of the other field may be automatically modified so the planes stay aligned
according to the Field Alignment rule.
Each field contains six planes (X1, X2, Y1, Y2, XC, and YC) that can be aligned with the planes of
another field.


A master field can be defined for a Field Alignment rule.
 The master field is not moved when the Field Alignment rules are applied. All other fields are
adjusted according to the master field.
 If the master field is not defined, the currently active field is considered as the master field and all
other fields are adjusted accordingly.
If there are several Field Alignment rules, the rules are applied in the order they are defined.
Field Alignment rules are applied to open fields only. Field Alignment is not available for proton fields or
plan sums.

<!-- page 362 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
361
EC17.0-PCD-01-A
Varian Confidential
Field Alignment rules are defined in the Field Alignments tab of the Info window.
 The rules do not become active until the tool is enabled.
 The Field Alignment tool may be turned on or off by selecting or deselecting the check box on the
tab of the Field Alignments window.





Preliminary Steps:
1) Create the plan and the setup fields.
2) Determine which fields will be aligned.
3) Determine which planes of those fields will be aligned.
4) Determine if those fields are parallel or opposing each other.
5) Determine if the isocenter will remain as set, the field sizes will remain as set or if the system will
be allowed to move everything to achieve the Field Alignment.
6) Determine if there will be a master field, the field that all the other fields will align to.
7) In this example, the objective is to match the upper border of the tangents to the inferior border (in
this case also the CAX plane) of the Supraclavicular field (SCLAV field.) The SCLAV field will
remain as set, so it will become the master field and other fields will adjust to it. The tangent fields
are also opposing each other, so if the gantry angle of one of them changes, the other should
automatically adjust so they remain 180 degrees opposite.

<!-- page 363 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
362
EC17.0-PCD-01-A
Varian Confidential
Define the Field Alignment rules:
1) You may wish to select a few options for viewing the field alignments before beginning Field
Alignment.
a) Right click anywhere in Model view.
b) Select ‘Show Field Alignment’.





a
b

<!-- page 364 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
363
EC17.0-PCD-01-A
Varian Confidential
2) Select the Field Alignments tab in the Info window.



a) Ensure the Field Alignment box is unchecked. If checked, the Field Alignment rules are
immediately activated as they are added.



2
a

<!-- page 365 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
364
EC17.0-PCD-01-A
Varian Confidential
3) To define the first alignment plane for the Field Alignment rule, click on the empty cell in the first
column (under “Field”).
a) A drop-down arrow appears on the right side of the cell. Click on it.


b) A drop-down list opens, displaying all the fields in the currently active plan
c) Click the desired field from the dropdown (01 AP Sclav).












a
b
c

<!-- page 366 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
365
EC17.0-PCD-01-A
Varian Confidential
4) Click the empty cell in the Edge column.
a) A drop-down arrow appears on the right side of the cell, Click it.
b) A drop-down list opens displaying all the planes of the field (X1, X2, Y1, Y2, XC and YC).





a
b

<!-- page 367 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
366
EC17.0-PCD-01-A
Varian Confidential

5) To indicate whether the next field will be parallel to
 or opposed to
 the
previous field select one of the Direction buttons.
a) For first field, select: 01 SCLAV and select its YC edge.
b) The direction will be ‘parallel to
 to 02 Medial Tangent.
c) The 02 Med Tang edge will be Y2.


6) To define a second alignment field for the Field Alignment rule, click the empty cell under the
second field column and select the field as before.
a) Add the information from the screenshot.




a
a
b
c

<!-- page 368 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
367
EC17.0-PCD-01-A
Varian Confidential
b) Create a third field alignment rule as in the screenshot below. The tangent fields will be
opposed.
 Repeat the field alignment as many times as necessary to create all the Field Alignment rules
needed.



 To view an alignment rule in the 3D View: Click a Field Alignment rule in the Field Alignments
tab.

The selected alignment rule is displayed in the Model view.

b

<!-- page 369 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
368
EC17.0-PCD-01-A
Varian Confidential
7) You will decide how the field alignment rules are completed. Select one of the following:
a) To keep field sizes unchanged during Field Alignment, select the Keep jaw positions option
button.

Note: The Keep jaw sizes check box is automatically selected when electron fields are
used.

b) To keep the field isocenters unchanged during Field Alignment, select the Keep isocenters
option button. *Use this option for this exercise*.


c) To allow the application to decide how to handle abutting Field Alignments, select the Auto
option button.



8) Use Keep isocenters for this plan.


a
b
c
8

<!-- page 370 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
369
EC17.0-PCD-01-A
Varian Confidential
9) Select the Master Field from the Master Field drop-down list. If the master field is not defined,
the currently active field is considered as the master field.
a) Select 01 SCLAV.


10) To display the order in which the alignment rules are applied,
a)  Click Show rule order button.
b) Click OK to close the dialog box field.


11) Save All.
12) Select the visibility check box in front of the Field Alignment tab to enable the Field
Alignment rules.




a
a
b
12

<!-- page 371 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
370
EC17.0-PCD-01-A
Varian Confidential
13) The rules are applied.


14) Select the Fields tab.
a) The parameters displayed in blue indicate where the Field Alignment rules have been
applied.






a

<!-- page 372 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
371
EC17.0-PCD-01-A
Varian Confidential
Modify a Field Alignment rule:
1) In the Field Alignments tab of the Info window, click the field or plane to modify.
2) A dropdown arrow appears on the right side of the cell. Click the arrowhead.
3) Select the desired item from the dropdown list that opens.
4) To change the parallel field to opposing and vice versa, click the toggle button located between
the two Field Alignment planes.
Note: It may be beneficial to disable the Field Alignment tool prior to making modifications
to the rules and enable it after the rule modification has been completed.

Delete Field Alignment rule:
1) In the Field Alignments tab of the Info window, click the
 button next to the Field
Alignment rule for it to be deleted.

<!-- page 373 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
372
EC17.0-PCD-01-A
Varian Confidential
Section 13: Create 2 Separate Plans from the Combined Plan
Eclipse needs 1 plan per calculation point. We will now create 2 separate plans from the SCLAV_TANGS
plan; one for each calculation point: SCLAV and BREAST CALC PT.

 We will copy and paste SCLAV_TANGS plan.
 We will change the name of the new plan to SCLAV.
 We will rename the SCLAV_TANGS plan to OPPOSED TANGS and continue planning.

 Follow the instructions below to create/change the new plans.
1) Right click on SCLAV_TANGS plan and select Copy Plan.
2) Right click on FLD ALIGNMENT course and select Paste Plan.
a) When Plan Properties dialog box opens, rename the plan AP SCLAV.
b) When SCLAV plan opens, delete the 02 Med and 03 Lat fields.
3) Open the SCLAV_TANGS plan.
a) Delete 01 Sclav field.
b) Rename this plan OPPOSED TANGS in Plan Properties dialog box.

<!-- page 374 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
373
EC17.0-PCD-01-A
Varian Confidential
4) The plan needs to be calculated.
a) Open AP SCLAV plan.
b) Click the Calculate Volume tool
. (You may need to select Use Default Models from
the Calculation Models tab in the information window to update the calculation models).
c) When plan is calculated, click Plan Normalization Mode in Dose tab in Info window.




a
b
c

<!-- page 375 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
374
EC17.0-PCD-01-A
Varian Confidential
d) Click 100% at Reference Point > SCLAV.
e) Click Apply then OK.


5) Save All.


e
d

<!-- page 376 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
375
EC17.0-PCD-01-A
Varian Confidential
Section 14: Field in Field
The field-in-field technique refers to a method of planning where the calculated dose is modified in certain
areas of the dose distribution by adding new segments into the existing fields. The aim is often to smooth
out or block hotter isodose lines in the plan. For more information on field in field, refer to Eclipse Photon
and Electron Reference Guide, P1047679-001-A.

1) Continue with patient US-EC-2007’s open course, FLD ALIGNMENT.
 The tangential fields created:

Parallel opposed fields with an independent posterior jaw.

Plan normalization point was created for this plan

A reference point has been created and moved to the desired location.

Plan has been re-normalized to the calculation point.

Note: The only structure that must be defined for Field in Field planning technique is the
body.

<!-- page 377 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
376
EC17.0-PCD-01-A
Varian Confidential
2) Calculate this plan and review the dose and weighting from each field. Make changes as
necessary to the weighting.
a) The plan should be normalized to the BREAST CALC PT.



Note: To visualize persistent dose, go to Tools > Task Configuration > Persistent Dose tab.
Click the Persistent Dose checkbox. Click OK.






a

<!-- page 378 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
377
EC17.0-PCD-01-A
Varian Confidential
To create a Field in Field plan for this patient:
1) Right click on the 02 Med Tang field.
a) Select New Field in Field.
Note: For Field in Field planning there must be an MLC attached to the original field(s). The
system will automatically create an MLC and align the leaves to the field borders in v16.0
and higher. The plan can contain bolus and wedges. If adding wedges, you will not be able
to merge the sub-fields. Blocks are not allowed.







a
1

<!-- page 379 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
378
EC17.0-PCD-01-A
Varian Confidential

Note: If the initial field is to be treated open, the MLC must be shaped at the edge of or
outside the field. The MLC Shaping tool may also be used to define a field with shielding to
block critical structures like the heart or lung. For this example we will be using an open
field.

b) An information box opens to tell you that the primary field has no MLC. Click OK to add a new
MLC automatically to fit the field size.




b

<!-- page 380 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
379
EC17.0-PCD-01-A
Varian Confidential
c)  The MLCs are added to the Med Tang fields.
d) The MLC Fit Options tool opens.
e) The Field Weights tool opens.
f)
Click Calculate Volume icon from the tool bar.
g) Click Save All.

h) MLC shape is now at field edges creating an open field.


h
e
c
d
f
g

<!-- page 381 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
380
EC17.0-PCD-01-A
Varian Confidential

2) After the plan is calculated and normalized you will need to visualize the isodose cloud that you
wish to block. The isodose visualization is used as a reference when adding the subfields to block
the desired isodose line. You will select an isodose cloud that is a few percent below the 3D Dose
MAX which is displayed in the upper left corner of the BEV window.
a) Select only the Body structure.
b) Maximize the BEV.
c) While holding down the shift key, double click the 110% Isodose Level in the BEV to add a
120% isodose cloud. (The cell will turn orange to indicate that the isodose level will be
added).
d) Deselect all but the 120% isodose cloud by clicking the checkmarks in front
e) The Isodose Cloud displays.
Tip: To change the color of the isodose cloud, right click on the yellow Isodose Levels [%]
and select Isodose Levels from the menu.


Note: Isodose lines to be blocked are generally selected to be solid and continuous but not
large. They are generally a few percent from the maximum dose on the plan.


e
c, d
b
a

<!-- page 382 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
381
EC17.0-PCD-01-A
Varian Confidential
3) Create the first medial subfield.
a) The first subfield is created with the ID of the original field with a .1 on the end. For this
example it is Med Tang.1 (For subsequent fields the label will be Med Tang.2 will be for be
the second and so on). The MLC is automatically created.
b) Using the Shaping tool draw the MLC aperture that will block the high dose area. Start
outside the field edge, (for this example at number 1) anterior to the hot spot, draw behind the
high dose area, and continue to inferior part of the field to draw an aperture. Next draw
towards the posterior, next, superior then anterior again. End the drawing at the beginning
point.

Note: MLCs are being utilized for blocking so an aperture must be defined to block out the
isodose line while continuing to treat the remainder of the patient’s breast.





b

<!-- page 383 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
382
EC17.0-PCD-01-A
Varian Confidential
c) Click the Calculate Volume tool.
d) Save All.



4) You will Increase the weight of the subfield, decreasing the weight of the initial open field until the
isodose cloud disappears.
a) Note that a checkmark in the Interactive apply is selected by default.
b) Adjust the field weights using the slider bar or type in the desired percentage under
Weight until the isodose level you are evaluating disappears. For this example, 120%.
Note: All subfields will default to “0” MU and “0” dose. As the weighing increases so will the
MUs. It can be helpful to note the MUs while weighting the subfields as generally 3-10 MUs
will be delivered to a subfield.




d
c
a
b

<!-- page 384 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
383
EC17.0-PCD-01-A
Varian Confidential
c) Isodose cloud (level) disappears with the weighting changes.
d) When finished, click Close.


5) Save All.

d
c
5

<!-- page 385 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
384
EC17.0-PCD-01-A
Varian Confidential
6) To evaluate the dose to be blocked with the next subfield:
a) Activate the Lat Tang field.
b) Click Isodose [%] in BEV and type the next desired isodose level a few % below the 3D
Dose MAX (here it is 117.)





b
a

<!-- page 386 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
385
EC17.0-PCD-01-A
Varian Confidential
c) Right click on Lat Tang field.
d) Select  New Field in Field.


e) Draw the MLC aperture as before blocking the dose cloud.



e
d
c

<!-- page 387 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
386
EC17.0-PCD-01-A
Varian Confidential
f)
Click the Calculate Volume tool.


7) Close the calculation window and Save All. Use the Field Weight tool as before.
a) Adjust the Lat Tang.1 weight using the slider bar or type in the percentage until the dose
cloud is removed.
b) Click Close when cloud is gone.




f
a
b

<!-- page 388 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
387
EC17.0-PCD-01-A
Varian Confidential
8) Right click the Med Tang and select New Field in Field.
a) Click Isodose [%] in BEV and type the next desired isodose level (here it is 114.)
b) We will use the Select MLC leaves tool to draw the next MLCs . Click Cancel on the MLC Fit
Options.
c) Select MLC leaves
 tool on Toolbar.



d) Holding down the shift key, select a bank of leaves and move the selected leaves over the
area you wish to block. This option is helpful if you have a lung block that could be moved.

a
b
d
c

<!-- page 389 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
388
EC17.0-PCD-01-A
Varian Confidential
e) Adjust the MLC leaves to fit.

9) Calculate the new subfield and adjust the weighting as necessary.
a) Note that the subfield that you’ve already applied weighting to is locked by default leaving the
original field unlocked.


10) Continue the process, always using the original Medial and Lateral fields to add the New Field in
Field to, until the dose is reduced to the desired level.












a
e

<!-- page 390 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
389
EC17.0-PCD-01-A
Varian Confidential
11) If the new field in field block edges are too close to the Normalization point:
a) Select the Dose tab from the information window.
b) Click the button for Plan Normalization.
c) Lock the Plan Normalization by selecting Plan Normalization Value.
d) Click OK and continue to add Field in Fields until the dose distribution is optimal.

12) The field weight can be adjusted with all fields and subfields by opening the Field Weight tool.
a) Press F3 on the keyboard. The Field Weights dialog box opens.
b) Lock all fields except for the original field and one subfield associated with the original field.
For example, Med Tang and Med Tang.2.  All other fields should be locked.
c) When finished, click Close.




b
11
a
c
d
a
c
b

<!-- page 391 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
390
EC17.0-PCD-01-A
Varian Confidential
13) After all of the segments have been created, subfields may be merged into one field for easier
treatment.
Note: All parameters must be exactly the same for all subfields to merge including gantry,
collimator, couch angle, field sized and beam energies. If any subfield parameter deviates,
it will not merge with the original field and will be considered a standalone field.
Note: If you are planning for Halcyon and using the Dynamic Beam Flattening Sequence,
you will not be able to Merge Subfields. The treatment plan subfields will be delivered as
standalone fields.

a) To merge the fields, select Planning.
b) Select Merge Subfields.



a
b

<!-- page 392 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
391
EC17.0-PCD-01-A
Varian Confidential
c) The Merge Subfields dialog box opens.
d) Click OK.



d
c

<!-- page 393 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
392
EC17.0-PCD-01-A
Varian Confidential
e) The Setting MUs for IMRT fields dialog box opens.
f)
Click Round to machine precision (or allow the system to round the MUs).
g) Click OK.



e
f
g

<!-- page 394 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
393
EC17.0-PCD-01-A
Varian Confidential
h) The Calculation Progress dialog box opens. Recalculation automatically begins.



i)
The Scope window displays the newly merged plan, OPPOSED TANGS1 and the
OPPOSED TANGS as rejected. The newly merged plan is available for plan approval.
Note: If the newly merged plan is not adequate, the original plan may be changed back to
unapproved status and manipulated.



14)  Save All.
i
h

<!-- page 395 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
394
EC17.0-PCD-01-A
Varian Confidential
Section 15:  Electron Plans
1) For this exercise, open patient EIPOPS, Breast Patient (US-EC-2007).


a) From the Object Explorer, select All Structure Sets.
b) Select Breast Contours.
c) Click OK.



c
b
a
1

<!-- page 396 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
395
EC17.0-PCD-01-A
Varian Confidential
General Information about electron fields:
 Electron fields are created at 100cm SSD.

2) To create an electron plan:
a) Select Insert menu.
b) Select New Plan.





a
b

<!-- page 397 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
396
EC17.0-PCD-01-A
Varian Confidential
c) The Select Course dialog  box opens.
d) Click an available course or place plan in a new course.  For this exercise, click Course1.
e) Click Next.



f)
The Plan Details dialog box opens.
g) Add ID and Name.
h) Add Dose information per screenshot.
i)
Click Next >.

c
d
e
i
h
g
f

<!-- page 398 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
397
EC17.0-PCD-01-A
Varian Confidential
j)
The Select Target Volume dialog box opens.
k) Place a checkmark in the No target volume checkbox if no electron target volume exists.
l)
Click Next.






j
k
l

<!-- page 399 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
398
EC17.0-PCD-01-A
Varian Confidential
m)  The Select Primary Reference Point dialog box opens.
n) Click New Reference Point.





m
n

<!-- page 400 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
399
EC17.0-PCD-01-A
Varian Confidential
o) The Reference Point Properties dialog box opens.
p) On General tab, ID and Name the new reference point, Electron Boost.
q) For Type, select Target.
r)
Enter the Dose Limits as shown.
s) Click OK.


o
p
r
s
q

<!-- page 401 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
400
EC17.0-PCD-01-A
Varian Confidential
t)
The Electron Boost reference point is highlighted.
u) Click Next > on Select Primary Reference Point dialog box.


v) The Select Treatment Machine dialog box opens.
w) Click iX1100.
x) Click Next >.


v
w
x
u
t

<!-- page 402 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
401
EC17.0-PCD-01-A
Varian Confidential
y) The Select Patient Position dialog box opens.
z) Select patient position. For this exercise, select Head First-Supine.
aa) Click Next >.





y
z
aa

<!-- page 403 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
402
EC17.0-PCD-01-A
Varian Confidential
3) The Field Properties dialog box opens.
a) Click the General tab.
b) Enter Electron in the ID and Name fields.
c) From Energy drop-down, select 12E.



a
b
c
2

<!-- page 404 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
403
EC17.0-PCD-01-A
Varian Confidential
d) Click the Geometry tab.
e) Click Fixed SSD from the Setup dropdown.
Note: If Fixed SSD has not been selected in Field Properties, Eclipse displays the following
message. Select ‘Yes’ to convert the field to ‘Fixed SSD’


Note: Using the Electron Monte Carlo (eMC) Algorithm, the beam may be placed to an
extended distance by modifying the SSD in the Info window, or by moving it manually using
the mouse or by adjusting the isocenter coordinate. The beam may also be moved by
modifying the SFED within the Geometry  tab.

d
e

<!-- page 405 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
404
EC17.0-PCD-01-A
Varian Confidential
f)
Click the Accessories tab.
g) Select an applicator from the Slot 2 Acc Mount dropdown. For this example, select A15.
h) Click OK.
Note: Do Not enter anything in the Slot 3 at this time. Wait until you add a block to add
anything to e-Aperture.




f
g
h

<!-- page 406 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
405
EC17.0-PCD-01-A
Varian Confidential
4) An Electron field is created.
a) The Applicator icon displays in the Focus window.
b) The field size is displayed in the Info Window. This default field size is set in RT Administration.
c) The end of the applicator is displayed (you may need to magnify the image to see this icon).
d) Isocenter is displayed at the skin surface.



a
c
d
b

<!-- page 407 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
406
EC17.0-PCD-01-A
Varian Confidential
5) Rotate the gantry to align the field to be enface to the CTV structure.
a) Click and drag the handle in the Transversal view.

b) Right click on the field in the Focus window.
c) Select Align Electron to…
d) Select Structure>CTV


a
b
c
d

<!-- page 408 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
407
EC17.0-PCD-01-A
Varian Confidential
6) Create an aperture block for the electron field.
a) Right click on the Electron field.
b) Select New Block…


b
a

<!-- page 409 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
408
EC17.0-PCD-01-A
Varian Confidential
c) The Block Properties dialog box opens.
d) Click e-Cutout from the Material code drop-down.
e) Click Aperture from Type area.
f)
Click e-Tray from the Tray ID dropdown (the Slot ID appears, in this case 3-e-Apperture).
g) Click OK.




c
e
f
g
d

<!-- page 410 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
409
EC17.0-PCD-01-A
Varian Confidential
h) Click the Fit to Structure icon on the Toolbar.



i)
The Fit Aperture Block to Structure dialog box opens.
j)
Select the Target structure as CTV.
k) Select Circular and set the margin to 1.5 cm.
l)
Click Fit.
m) Click Close.


h
i
j
k
l
m

<!-- page 411 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
410
EC17.0-PCD-01-A
Varian Confidential
n) To adjust placement of the block, select Block Select tool.


Note: Other Block tools available for creation/modification of electron blocks include:
 Removes all contours from the block .

 Freehand tool

 Fit to Structure

 Set Block Shape





n

<!-- page 412 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
411
EC17.0-PCD-01-A
Varian Confidential
7) Electron Monte Carlo Calculation and Field Normalization options:
a) Click Calculations Models tab in the Info window.
b) Click EMC_17.0.1 (latest version) from the drop-down.
c) Click Edit.





a
b
c

<!-- page 413 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
412
EC17.0-PCD-01-A
Varian Confidential
           Note: Calculation resolution options of 0.1, 0.15, 0.2, 0.25, 0.5mm can be selected from the menu.
 The grid covers the entire body volume by default; however, the grid can be resized.
 Calculation can be stopped by achieved statistical accuracy or by number of processed particles. If
the number of particle histories is set to 0, the calculation will stop on accuracy.
 Accuracy can be set to 1%, 2%, 3%, 5% or 8%;
The more accurate the calculation, the longer the calculation time. 1% accuracy allows for less
fluctuation than 8% accuracy, therefore 1% accuracy will have a longer calculation time.
Accuracy Limit is defined in Beam Configuration.
MU will be displayed if the actual accuracy is lower or equal to the accuracy limit value.
 Monte Carlo calculation gives a bumpy dose distribution by its nature. If desired, smoothing can be
used to remove the statistical noise from the dose distribution.
3 Smoothing Methods are available: No Smoothing, 2-D Median, 3-D Gaussian.
3 Smoothing Levels can be applied to the selected method: Low, Medium, and Strong.
 eMC transports in Medium and reports dose to Medium.
 Fixed SSD Field Normalization:
Absolute normalization based on calibration factors and a smoothed dose distribution.
100% at Central Axis Dmax normalizes the dose to the Dmax at central axis
100% is at global Dmax normalizes the dose to the global Dmax point which is not necessarily at
the Central Axis! This can be useful if the central axis is blocked.



Note: In eMC, you may normalize to either a volume or a reference point; due to the
statistical nature of Monte Carlo calculations, normalization to a reference point may be
considered less robust (or maybe consistent) due to the noise contributed to the calculation.
The basic concept is that with a statistically noisy calculation, normalization to a single point
could normalize to a point in the volume where the dose is either too high or too low
depending on exactly where the point lands.

<!-- page 414 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
413
EC17.0-PCD-01-A
Varian Confidential
d) The Calculations Options dialog box opens for more information refer to Eclipse Photon and
Electron Algorithms Reference Guide, P1047677-001-A.
e) Click Cancel to close.













d
e

<!-- page 415 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
414
EC17.0-PCD-01-A
Varian Confidential
Section 16: Plan Sums
General Information
Plan sums are created to view a combined dose distribution for two or more plans. After a plan sum is
created, any modifications done to the plan sum will update the original plans. Also, any modifications of
the original plans will update the plan sum. For more information refer to Eclipse Photon and Electron
Instructions for Use P1047678-002-B.
Plans must be from the same 3D image or registered 3D images. If more than one 3D image is used the
user must select the 3D image to use as a basis for the plan sum.
Summed plans are always displayed in Absolute Dose.

Note: Plan sums may be created and viewed in Plan Evaluation or External Beam
Planning. Options to modify fields differ, depending upon the application selected.

There are two options to create a plan sum in Eclipse
 Plan sums can be created after individual plans have been created. For example, a composite of
more than one plan.
 Plan sums can be created prior to any planning. The plan sum is created first, plans are placed
within the plan sum and fields placed within the plan. For example, you may want to combine a 3-
field breast plan to evaluate the plans as one since each plan will have a separate isocenter and
calculation point. By creating the plan sum the overall dose distribution can be evaluated.

<!-- page 416 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
415
EC17.0-PCD-01-A
Varian Confidential
We will continue with patient US-EC-2007 in External Beam Planning.
1) To create a plan sum from existing plans:
a) Select Insert.
b) Select New Plan Sum…





a
b

<!-- page 417 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
416
EC17.0-PCD-01-A
Varian Confidential
c) The Insert New Plan Sum dialog box opens.
d) Select the desired image to base the plan sum on. For this example, there is only one image.
Select Breast Contours.
e) Place checkmarks in  AP SCLAV plan and OPPOSED TANGS1 in the Select plans to
include in the sum column.
f)
Click OK.





c
d
f
e

<!-- page 418 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
417
EC17.0-PCD-01-A
Varian Confidential
g) Plan sum is created and displays in the Scope window.
h) Absolute Isodose displays.




h
g

<!-- page 419 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
418
EC17.0-PCD-01-A
Varian Confidential
Review the doses to each Reference Point
1) Select the Reference Points tab in the Info Window.
a) Review doses to the SCLAV reference point and the BREAST CALC PT.










1
a

<!-- page 420 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
419
EC17.0-PCD-01-A
Varian Confidential
Review the Dose Distribution
1) Because two plans were summed together, the isodose levels have doubled. To display the correct
isodoses on the Plan Sum, right click on the yellow Isodose Levels in the upper left corner of the
transversal view.
a) Select Isodose Levels.

b) The Dose Isolevel Editor dialog box opens.
c) Select Scale All.
d) Enter the prescription dose 5040 cGy in the dose cell that represents 100% isodose level. (In this
case, it will be next to the yellow color and style bar.)
e) Click Enter on the keyboard.
f)
The doses will scale to the prescription dose.
g) Click OK.

1
a
h
b
d
c
f

<!-- page 421 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
420
EC17.0-PCD-01-A
Varian Confidential
2) Review the dose distribution on the summed plan in all three planes.
a) You can continue to improve both plans from the Plan Sum.

<!-- page 422 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
421
EC17.0-PCD-01-A
Varian Confidential
 The following is for information purposes only.
To create a plan sum prior to planning:
1) Select Insert.
a) Select New Course…



b) The Course Properties dialog box opens.
c) For this example, type New Plan Sum for the ID.
d) Click OK.


1
a
b
c
d

<!-- page 423 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
422
EC17.0-PCD-01-A
Varian Confidential

e) Select Insert.
f)
Select New Plan Sum…




g) The Insert New Plan Sum dialog box opens.
h) Click Add New Plan.




e
f
h
g

<!-- page 424 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
423
EC17.0-PCD-01-A
Varian Confidential
i)
The Select Course dialog box opens.
j)
Select the desired course.  For this example, select Plan Sum
k) Click Next >.









i
j
k

<!-- page 425 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
424
EC17.0-PCD-01-A
Varian Confidential
l)
Plan Details dialog box opens.
m) Add an ID
n) Add Dose information per the screenshot.
o) Click Next >.




m
n
o
l

<!-- page 426 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
425
EC17.0-PCD-01-A
Varian Confidential
p) The Select Plan Target Structure dialog box opens.
q) Select target. For this example, select CTV.
r)
Click Next >.





p
q
r

<!-- page 427 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
426
EC17.0-PCD-01-A
Varian Confidential
s) The Select Primary Reference Point dialog box opens.
t)
Click New Reference Point.

u) Enter the ID as Boost DPV.
v) Select the Type as Target.
w) Enter the Dose Limits as shown.

u
w
v
s
t

<!-- page 428 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
427
EC17.0-PCD-01-A
Varian Confidential

x) Select Boost DPV.
y) Click Next >.


y
x

<!-- page 429 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
428
EC17.0-PCD-01-A
Varian Confidential
z) The Select Treatment Machine dialog box opens.
aa) Select iX 1100.
bb) Click Next >.





z
bb
aa

<!-- page 430 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
429
EC17.0-PCD-01-A
Varian Confidential
cc) Select Patient Position dialog box opens.
dd) Select Head First Supine.
ee) Click Next >.



















cc
dd
ee

<!-- page 431 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
430
EC17.0-PCD-01-A
Varian Confidential

ff) The Field Properties dialog box opens.
gg) Enter the field ID as Med Bst Tang
hh) Add Tolerance.
ii) Click OK.



ff
ii
hh
gg

<!-- page 432 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
431
EC17.0-PCD-01-A
Varian Confidential
jj) New plan is added.
kk) Click Add New Plan and repeat steps 1i – 1ii to create Lt BreastTang.


ll) Plan2 is now available.
mm)
Click OK.





kk
mm
ll
jj

<!-- page 433 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
432
EC17.0-PCD-01-A
Varian Confidential
3) The two new plans with fields are ready to plan in the Focus window. Create the plans as normal. They
will calculate together as a pair.

<!-- page 434 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
433
EC17.0-PCD-01-A
Varian Confidential
Bookmarks and RT Peer Review
Section 1: Bookmarks and RT Peer Review Overview
During the planning process, you can save the current view settings by adding a bookmark for a plan or an
image in External Beam Planning and for single or multiple plans in Plan Evaluation. You can view or
manage the bookmarks directly in External Beam Planning and Plan Evaluation, or open bookmarks added
in External Beam Planning later via RT Peer Review for performing peer review for plans or images.
When you add a bookmark in External Beam Planning, the following settings are saved in the bookmark:
 Active 3D or 4D plan and plan sum
 Active 3D and 4D images (with at least one structure set)
 Image visibility selection of a 3D or 4D image with registration
 Window/level of the image
 Active view layout
 Selection of Model View, Dose-Volume Histogram View, Beam’s Eye View, Dose-Volume
Histogram View, or Arc Plane View
 Visibility of the Context Window and Info Window, tab selection in the Info Window
 Visibility selection of structures and structures selected to be viewed in the DVH and DVH
estimations
When you add a bookmark in Plan Evaluation, in addition, the following settings are saved in the bookmark:
 Linking of view geometries in Two Orthogonal Views, Multiple Plans and Multiple Plan
Comparison views
 View mode selection of the Multiple Plan Comparison view: DVH, Transversal views, both DVH
and transversal views
 Selected field/applicator visualization, dose visualization and structure visualization in the
Multiple Plan Comparison view
When the bookmark is applied, the system restores the display of the patient data corresponding to the
display of the patient data at the time the bookmark was stored.
Note: The system always displays the latest saved patient data, even if the data has been
modified after the creation of the bookmark.

Tip: You can include a plan in RT Peer Review also when you planning approve a plan. In
that case, the bookmark is created with the default view settings.

<!-- page 435 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
434
EC17.0-PCD-01-A
Varian Confidential
User Rights for RT Peer Review
Access to Varian Medical applications and software features is based on licenses and user rights. Rights
must be assigned to allow users to access certain applications in Eclipse. User Rights Administration in
Varian Service Portal allows you to centrally manage users, user groups, and user rights for all Varian
Medical applications.
1) Log into Varian Service Portal.
a) From the search window on your vApp Desktop, type Varian Service Portal.
b) Select Varian Service Portal from the list of Websites.






a
b

<!-- page 436 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
435
EC17.0-PCD-01-A
Varian Confidential
c) Login with cwalker credentials.

d) From VSP home page, select Security.
e) Select Rights from the dropdown menu.

f)
From the Update Rights page, select the Groups banner to filter the options.









c
d
e
f

<!-- page 437 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
436
EC17.0-PCD-01-A
Varian Confidential
g) Deselect the option for Select All.
h) Select the options for System Administrator, Oncologist and AllRights.
i)
Click Apply.


j)
From the Privilege Name column, type Peer into the search window.
k) Ensure that System Administrator, Oncologist and AllRights groups have Privileges selected for
all Peer Review options.
l)
Click Save.








i
h
g
j
k
l

<!-- page 438 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
437
EC17.0-PCD-01-A
Varian Confidential
2) Check that the users have been granted group rights for one of the groups with RT Peer Review access
rights.
a) Select the Security tab.
b) Select Users.

c) Enter cwalker in the search window under the Name column to filter for this user.
d) Ensure that cwalker has group access rights for one of the groups.

e) Enter dvance in the search window under the Name column to filter for this user.
f)
Ensure that dvance has group access rights for one of the groups.
g) Click Logout and return to External Beam Planning.


Note: To change the user’s group, double click in the group cell and select a new group
from the dropdown menu.
b
a
d
c
e
g
f

<!-- page 439 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
438
EC17.0-PCD-01-A
Varian Confidential
Section 2: Create Bookmarks for Physician Review

1) Open the plan that is ready for the physician to review. For this exercise, use patient EIPOPS, BREAST
PATIENT (US-EC-2007).
a) Load the plan OPPOSED TANG1 from the FLD ALIGNMENT course and setup the image display in
the graphic view to best demonstrate the plan according to department protocols.
b) Select Add Bookmark.











b
a
1

<!-- page 440 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
439
EC17.0-PCD-01-A
Varian Confidential
c) The Add Bookmark dialog box opens.
d) Enter the Name for the Bookmark as Left Breast Tangents.
e) For this example, we will not select to Include the bookmark for RT Peer Review.
f)
Add a note for the physician: Please review this plan.
g) Click OK.


h) Drag in the AP SCLAV plan and setup the display in the graphics view to best demonstrate the plan
according to department protocols.
i)
Click Add Bookmark.


e
d
f
g
i
j
c

<!-- page 441 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
440
EC17.0-PCD-01-A
Varian Confidential
j)
The Add Bookmark dialog box opens.
k) Enter the Name for the Bookmark as Left AP SClav.
l)
For this example, we will not select to Include the bookmark for RT Peer Review.
m) Add a note for the physician: Please review this plan.
n) Click OK.

o) Drag in the Plan Sum and setup the display in the graphics view to best demonstrate the plan
according to department protocols.
p) Click Add Bookmark.

l
k
m
n
o
j
p

<!-- page 442 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
441
EC17.0-PCD-01-A
Varian Confidential
q) The Add Bookmark dialog box opens.
r)
Enter the Name for the Bookmark as Lt SClav and Lt Breast Tangs Plan Sum.
s) For this example, we will not select to Include the bookmark for RT Peer Review.
t)
Add a note for the physician: Please review this plan sum.
u) Click OK.

Note: The planner will need to notify the physician that plans are ready for review.
Bookmarks save time in the clinic because the physician will know exactly which plans are
ready for review from the Bookmark manager.



q
s
r
u
t

<!-- page 443 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
442
EC17.0-PCD-01-A
Varian Confidential
Section 3: Use Bookmark Manager to Review Plans

1) From the upper right corner, select the dropdown menu under cwalker.
a) Select Switch User.

b) The Switch User login box opens. Login as dvance (User Name dvance, Password dvance).
c) Click OK.

d) Navigate to External Beam Planning from the QuickLinks menu.
e) From the patient search window open EIPOPS, BREAST PATIENT.




a
c
b
d
e

<!-- page 444 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
443
EC17.0-PCD-01-A
Varian Confidential
f)
The Object Explorer dialog box opens.
g) For this example, click Cancel. This way, the physician does not need to search through multiple
courses and plans.


h) With the patient open in the Patient Search window, click Bookmark Manager from the tool bar.



Tip: When the patient already has bookmarks defined in this workspace, the Bookmark
Manager is displayed.

Note: If a plan or image is deleted after the bookmark creation, the bookmark cannot be
applied. Comments and the creation and modification history are still available.





f
g
h

<!-- page 445 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
444
EC17.0-PCD-01-A
Varian Confidential
i)
The Bookmark Manager panel opens.
j)
Select the first plan OPPOSED TANG1 to load and review the plan.

k) Right click on the plan.
l)
Select Plan Approval.
m) Select Planning Approved.




i
j
k
m
l

<!-- page 446 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
445
EC17.0-PCD-01-A
Varian Confidential
n) The Warnings and Errors dialog box opens. Review the errors and warnings and click Next.

o) Review the Dose Summary and click Next.


n
o

<!-- page 447 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
446
EC17.0-PCD-01-A
Varian Confidential
p) From the Delta Couch Shifts dialog box, click Use values calculated from user origin.
q) Click Next.













q
p

<!-- page 448 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
447
EC17.0-PCD-01-A
Varian Confidential
r)
From the Parameters dialog box, select CTV and Body to Generate structure outlines to
reference images.
s) Select Generate DRR’s to fields.
t)
Select Include the plan for RT Peer Review.
u) Select Calculate treatment times.
v) Enter a Multiply with factor value of 1.5.
w) Click Finish.

x) Enter credentials and click Authorize.

v
u
t
s
r
w
e

<!-- page 449 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
448
EC17.0-PCD-01-A
Varian Confidential
It is possible to edit and delete the bookmarks from Bookmark Manager. However, it is not possible to delete
a bookmark in External Beam Planning if it was used in an RT Peer Review session.
If two users have the same patient open, and one user has deleted/edited the bookmark that the other user
wants to modify, the system informs that the bookmark is deleted and offers the possibility to create a new
bookmark that contains the same information as the deleted bookmark.
2) Repeat the process for each bookmarked plan.
a) Place a checkmark in front of each plan to include the bookmark in RT Peer Review.
b) Click Reviewed to clear the bookmarks.
c) Click Close.


Note: To review the bookmarks again, click Active to load the bookmarks. The creation
and modification history of active and pervious bookmarks is displayed at the bottom of the
Bookmark Manager.

Tip: The Bookmark Manager is docked to the left by default. To move the Bookmark
Manager panel, click and drag the title bar to another location.

b
a
c

<!-- page 450 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
449
EC17.0-PCD-01-A
Varian Confidential
Section 4: Bookmarks in Plan Evaluation

New to Eclipse v17.0 and higher, Bookmarks can now be created in the Plan Evaluation workspace.
The Bookmarks added in Plan Evaluation are only accessible from Plan Evaluation and cannot be
accessed from RT Peer Review. For more information please see Eclipse Photon and Electron
Instructions for Use P1047678-002-B.
Note: Bookmarks created in Eclipse v16.0/16.1 will be visible but will not function in v17.0
and higher. This is due to a platform change that allows bookmarking of multiple plan
comparisons in Plan Evaluation.

1) From the upper right corner, select the dropdown menu under dvance.
a) Select Switch User.


b) The Switch User login box opens. Login as cwalker.
c) Click OK.




a
c
b

<!-- page 451 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
450
EC17.0-PCD-01-A
Varian Confidential

d) Navigate to Plan Evaluation from the QuickLinks menu.
e) From the patient search window open US-EC-2222, ECOPS, LUNG PT.



f)
From the Object Explorer, select Course 1.
g) Click OK.





d
e
g
f

<!-- page 452 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
451
EC17.0-PCD-01-A
Varian Confidential
h) Select Window from the menu bar.
i)
Select Two Orthogonal Views.

j)
Drag in each plan to view them side-by-side. This will compare the AAA vs Acuros calculated plans.
k) From the Tool Bar click Link View Geometries.



h
i
k
j

<!-- page 453 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
452
EC17.0-PCD-01-A
Varian Confidential
l)
From the Menu Bar select Evaluation.
m) Select Show Dose Volume Histogram View.

n) Setup the display in the graphics view to best demonstrate the plan according to department
protocols.
o) Click Add Bookmark from the Tool Bar.



l
m
o

<!-- page 454 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
453
EC17.0-PCD-01-A
Varian Confidential
p) The Add Bookmark dialog box opens. Enter the name of the Bookmark as Compare AAA and
Acuros.
q) Add a comment for the physician as Please Review these two plans.
r)
Click OK.

s) The Bookmark Manager icon highlights on the Tool Bar.
t)
Click the Bookmark Manager.

u) The Bookmark Manager panel displays.
v) Click Close.

p
q
r
t
v
u

<!-- page 455 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
454
EC17.0-PCD-01-A
Varian Confidential
Section 5: Working in RT Peer Review

RT Peer Review is an application that allows users to perform review sessions for patients identified with
bookmarks or planning approval included in External Beam Planning. A review session gives you quick
access to various patient relevant information stored on the ARIA OIS and Eclipse database:
 Patient demographics
 Treatment prescription
 Diagnostic information
 Imaging, contouring and treatment plan information
 Last treatment or imaging date
During a review session, bookmarks and plans previously prepared in External Beam Planning are
displayed in read-only mode.
Action Items are important remarks added during the review of a patient. An Action Item might require
changes to a plan, contour or follow up. Action Items are recorded on the Action Items tab and made
available to users to mark them as closed one the follow up is completed. Once an Action Item is closed, it is
removed from the list.
RT Peer Review keeps track of all review sessions and action items. You can search for any specific review
session report and/or patient review history on the History tab.
During a review session, it is possible to postpone the review of a patient. When you postpone the review, the
patient remains in the list of available patients until the end of the current review session. You can recall the
review of a postponed patient at any time during the review session. When you finish a review session, all
postponed patients will remain available in the Patients tab for future review.
A review session ends when:
 No more patients are pending for review
 You terminate the review session at any time during the patient review

Note: A patient can only be in one active review session at a given time. In case another
user tries to start a second review session for the same patient, the system notifies the user
that the patient is currently under review. Patients belonging to an open review session
have a Lock status and cannot be assigned to any other session.

<!-- page 456 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
455
EC17.0-PCD-01-A
Varian Confidential
Preparing a Review Session
To streamline a review session, it is possible to prepare patient information beforehand. You can:
 Include or exclude patients from the review session
 Group patients by their primary oncologist
 Link existing ARIA documents to a patient
 Preload all patient 3D images that are referenced by bookmarks or plans added to peer review
from the planning approval process
Note: If an approved plan included in RT Peer Review is unapproved, the patient will
remain in the Patients tab.

1) Open the RT Peer Review workspace.
a) From the QuickLinks menu
b) Select Treatment Management
c) Select RT Peer Review




a
b
c

<!-- page 457 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
456
EC17.0-PCD-01-A
Varian Confidential
d) RT Peer Review opens with the Patients tab open and the patient EIPOPS, BREAST PATIENT in
the review list.
e) To include this patient in the next review session, ensure the selection checkmark in the upper right
corner of the patient card is active.
f)
You can add documents from ARIA by clicking the Paper Clip icon to link the document.



g) An information box appears to tell us that this patient does not have any saved documents.
h) Click OK.


i)
Click Preload Patient Data.

j)
A progress bar displays in the lower left corner.


e
f
h
g
i
j
d

<!-- page 458 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
457
EC17.0-PCD-01-A
Varian Confidential
Activate a Review Session
1) You can start a review session with the selected patients after you Preload Patient Data.
a) To start a review session with the selected patient, click Start Review Session.

b) The review session opens with the first patient on the list. The Patient Overview panel displays the
patient’s name, ID1, diagnosis, patient photo and treatment progress.
c) External Beam Planning is opened in read-only mode. You can scroll through the images, review
structures, review the fields, review and change the dose, renormalize the plan, display the DVH,
display Clinical Goals, etc, just as you would in the application.
d) The number of patients for the review session is shown next to the Patients Not Reviewed icon.
e) The number of patients postponed is shown next to the Patients Postponed icon.
f)
To see a list of the patients waiting for review, click the List View icon.

a
d
e
b
f
c

<!-- page 459 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
458
EC17.0-PCD-01-A
Varian Confidential
g) The List View displays. To return to the patient panel, click the Patient View icon.
h) To end the Review Session, click the Finish Review Session icon. (Do not Finish Review
Session.)


Note: Selecting a different patient from Patient List will open the new patient. The original
patient will be displayed at the end of the current review session
Note: Selecting a different patient from the Search Patient window in the Assistant Bar or
the Patient Explorer will pause the review session. The new patient will be opened in read-
only mode in External Beam Planning. The review session can be resumed at any time by
clicking the Resume button on the Patient Overview panel.













h
g

<!-- page 460 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
459
EC17.0-PCD-01-A
Varian Confidential
i)
The list of Bookmarks created in External Beam Planning can be selected to display the
information in the Review Session. Click the next Bookmark.
j)
Notes can be added in the Review Notes window.
k) The Review Session can be postponed by clicking the Postpone Review icon.
l)
The user can accept the review by clicking the Accept Review icon. This action will complete the
review of the current patient. (Do not accept the review).
m) Continue to review each Bookmark.
n) Any attached documents will display beneath the Bookmarks.
o) To add an Action Item, select the AP SCLAV plan bookmark and click the Action Item icon.










n
o
i
l
k
j

<!-- page 461 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
460
EC17.0-PCD-01-A
Varian Confidential
p) To assign an Action Item, enter the information in the notes window. (A review note is mandatory
when adding an Action Item). For this exercise, type Replan with gantry at 350⁰ and add an MLC
to block the left humeral head.
q) Click OK.



d
d

<!-- page 462 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
461
EC17.0-PCD-01-A
Varian Confidential
The Review Session History Tab

1) After the review session is complete, the Review Session History tab will open automatically.
a) The list of Review Sessions displays in the Review Sessions panel.
b) The list of reviewed patients displays in the Reviewed Patients panel.
c) The Review Session Report summary opens.
d) The report can be exported by clicking the Export button in the lower right corner.
e) Note that the Summary displays an alert.

f)
Click the Action Items tab. The number of Action Items displays next to the tab.







a
e
c
b
f
1
d

<!-- page 463 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
462
EC17.0-PCD-01-A
Varian Confidential
g) The Action Items display.
h) Hover over the Action Items to display the Close button. Click the Close button when the Action
Item has been completed to remove it from the list.



Note: Documents are saved in the local directory. At the end of a review session, the
system will delete the documents saved in the local directory. If a document remains open,
the system will attempt to delete it at the start of the next review session.



h
g

<!-- page 464 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
463
EC17.0-PCD-01-A
Varian Confidential
Plan Evaluation
Section 1: Plan Evaluation Overview
References:
1. Eclipse Photon and Electron Reference Guide P1047679-001-A
2. Eclipse Photon and Electron Instructions for Use P1047678-002-B
Eclipse offers several tools for use in evaluating a treatment plan prior to final approval. This section will
explore the following options:
 Dose Display Options

Viewing the Isodose Display / Isodose Levels

Isodose Color Wash

Dose Color Wash

Absolute vs. Relative Dose

Point Dose Tool

Water Equivalent Dose Tools

Default Options for Dose Display Settings
 Dose Volume Histograms (DVH)

Overview

Toolbar Options

Other Options

Plan Comparison DVH

Export and Print DVH

<!-- page 465 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
464
EC17.0-PCD-01-A
Varian Confidential
Section 2: Isodose Levels
For this procedure, use patient US-EC-2000, EC OPS, DOSE CALC. Open the AAA Dose Calc Plan
from Course 1 in the External Beam Planning workspace.
1) If the plan has not been calculated, calculate the plan. 200cGy X 30 fx. Field weights total =
1.0.
2) The calculated plan will show the default Isodose levels representing dose within the Body
structure.



2

<!-- page 466 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
465
EC17.0-PCD-01-A
Varian Confidential
3)   To modify Isodose levels:
a) Right click on Isodose Levels in the Transversal view.
b) Click Isodose Levels…




a
b

<!-- page 467 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
466
EC17.0-PCD-01-A
Varian Confidential
c) The Relative Dose Isolevel Editor dialog box opens displaying the default relative template.
d) To add an isodose level, click Add.

Note: Newly added Isodose values appear with the 2D cell of the grid automatically
checked. The 3D value can be checked if the user desires to see the dose in the 3D view
also.

e)  A new line appears on the Isodose grid, highlighted in orange.
f)
The color for the new level defaults to White.







c
d
e
f

<!-- page 468 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
467
EC17.0-PCD-01-A
Varian Confidential
g) Type the Relative Dose percentage you want the new level to represent. For this example,
enter 50.
h) Click White in the grid.
i)
A drop-down (caret) appears.



i
g
h

<!-- page 469 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
468
EC17.0-PCD-01-A
Varian Confidential
j)
Click the drop-down.

Note: Color choices are available by standard color naming convention, with a prefix of
Contour, Translucent, or Segment (referring to how the color will be displayed in the 3-
dimensional view, or as a standardized RGB number


k) Colors/styles appear. For this example, choose the color, Contour Light Green.


j
k

<!-- page 470 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
469
EC17.0-PCD-01-A
Varian Confidential
l)
Click in Line width to change the value.  For this example, select 3.

Note: Line width affects the isodose level display in the 2D views. The range for line width
is between 1 (thinnest) and 5 (widest).


m) Click Apply.



m
l

<!-- page 471 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
470
EC17.0-PCD-01-A
Varian Confidential
n) The newly added Isodose value is visible on the treatment plan images in the 2D views.


o) Isodose level values can be changed by double clicking in the value cell. For this example,
double click in the cell for the value 110.0.


o
n

<!-- page 472 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
471
EC17.0-PCD-01-A
Varian Confidential
p) With the cursor, swipe to highlight the current value of 110.0.


q) Type the value you desire for this cell. For this example, type in the value of 108.0.
r)
Click Apply.


p
q
r

<!-- page 473 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
472
EC17.0-PCD-01-A
Varian Confidential
s) The changes made now appear in the 2D view of the planning image.
t)
Because the 3D box was unchecked as the default for the 50% line we added, the 50% value
is not checked in the 3D view.



s
t

<!-- page 474 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
473
EC17.0-PCD-01-A
Varian Confidential
u) To delete a level, select the desired level to delete. For this example, select 80%.
v) Click Remove.
w) Click Apply.


x) The 80% line no longer displays in the Relative Dose Isolevel Editor dialog box nor the
treatment plan images.


v
w
u
x

<!-- page 475 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
474
EC17.0-PCD-01-A
Varian Confidential
y) To change the isodose level template, select a template from the Isodose Level Templates
drop down. For this example, select 80/40.
z)  Click Apply.




z
y

<!-- page 476 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
475
EC17.0-PCD-01-A
Varian Confidential
aa) The new isodose template displays.


4) Change to Absolute Dose.
a) Click Use Absolute Dose.
b) Click Apply.
c) See the Absolute dose in 2D/3D views.


aa
a
b
c

<!-- page 477 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
476
EC17.0-PCD-01-A
Varian Confidential
d) Click Use Relative Dose.
e) From Isodose Level Templates drop-down, select Default Relative-Default 100% Relative.
f)
Click Apply.



d
e
f

<!-- page 478 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
477
EC17.0-PCD-01-A
Varian Confidential
Section 3: Scale Doses
1) You may Scale all the Isodose and Absolute lines.
a) Click Scale All.
b) Type 200 under Relative Dose %.
c) Click Apply.




b
c
a

<!-- page 479 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
478
EC17.0-PCD-01-A
Varian Confidential
d) All lines are scaled to the typed percentage (200% in this example.)


e) Click Use Absolute Dose.
f)
Click Add to All. (This allows you to add doses.) In this example, add 50cGy to 12000.
g) Click Apply.



d
f
e
g

<!-- page 480 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
479
EC17.0-PCD-01-A
Varian Confidential
h) 50cGy are added to all doses.
















h

<!-- page 481 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
480
EC17.0-PCD-01-A
Varian Confidential
Section 4: Change Isodose Levels in Graphics View
You may also change Relative Isodose Levels to Absolute dose in the Graphics views.
1) Hover the mouse over the Relative percentage [%] and the cGy is visible.


a) Click the [%] and the doses change to Absolute.

1
a
cGy

<!-- page 482 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
481
EC17.0-PCD-01-A
Varian Confidential
b) Click the checkmark in front of one isodose levels to turn it off.



Note: To turn off all isodose lines at once, Shift + Click any check mark.




b

<!-- page 483 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
482
EC17.0-PCD-01-A
Varian Confidential
Section 5: Isodose Color Wash and Dose Color Wash
The dose displays with a continuous color map in the 2D image views and in the Arc Plan View and as a
dose cloud or surface dose in the Model view.
1) To convert the dose to Isodose Color Wash,
a) Click Isodose Levels in the Transversal View.
b) The display changes to Isodose Color Wash.




c) Click again to change the dose display to Dose Color Wash.

b
a
c

<!-- page 484 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
483
EC17.0-PCD-01-A
Varian Confidential
Note: Isodose Color Wash displays the colors in steps according to the isodose levels.

d) You can enter a minimum and maximum dose to display dose color wash. To enter a
minimum dose, swipe across the value at the bottom of the slider. For this example, enter 50.
Click Enter on keyboard.

Note: Dose is displayed in percent of the prescribed dose or Relative Dose.


e) To display a maximum dose, swipe across the value at the top of the slider.  For this
example, enter 100. Press Enter on keyboard.














e
d

<!-- page 485 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
484
EC17.0-PCD-01-A
Varian Confidential
f)
Moving the slider between the 2 values displays the percentage of the dose the structures are
receiving.
g) Move the slider to approximately 80% and evaluate how the color wash changes to reflect
that value.


h) Click Dose Color Wash in the Transversal view to return to Isodose Levels display.



g
h

<!-- page 486 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
485
EC17.0-PCD-01-A
Varian Confidential
Section 6: Move Viewing Planes to Global Maximum Dose
1) You can move the viewing planes to display the points of Global Dose Maximum, Target Dose
Maximum, Target Dose Minimum, or Normalization Point. To move the viewing planes:
a) Right click the Dose in the Focus Window.
b) Select Move Viewing Planes to:
c) For this example, select Global Dose Maximum.






















c
a
b

<!-- page 487 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
486
EC17.0-PCD-01-A
Varian Confidential
d) The system moves the viewing planes to the global dose maximum indicated by the red
dot/orange circle.
























d

<!-- page 488 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
487
EC17.0-PCD-01-A
Varian Confidential
2) You can move the viewing planes to display the points of Dose Maximum for a selected
structure. To move the viewing planes:
a) Right click the structure from the structure set. In this case, select Rectum.
b) Select Move Viewing Planes to Dose Maximum.
c) The Viewing Planes move to the maximum point dose for the select structure.
d) The Point Dose Tool dialog box opens to display the maximum dose at this point from each
field.


e) Click the % Icon next to Isodose Levels to display the dose in Absolute Dose.


b
c
a
d
e

<!-- page 489 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
488
EC17.0-PCD-01-A
Varian Confidential
Section 7: Point Dose Tool
Point dose is the dose calculated for a point in the volume. Point Dose Tool measures the dose to the
point that you click a plane displayed in an image view.
1) You can use the point dose, for example, to define the normalization value used for normalizing
the dose distribution to a selected point or to check the dose values at a critical point.
a) To display information at a selected point, select the Point Dose tool from the tool bar.
b) Place the tool at any point on the body in any viewing plane by clicking on the point you wish
to measure. For this example, place the point on the femoral head in the transversal view.
The Point Dose dialog box opens.
c) The Normalized Dose and Unnormalized Dose are noted for each field.
d) The specific location of the point displays as x, y, and z coordinates.





Note: You can move the point around the plan with the mouse and the information will
dynamically update.


Note: If using Acuros XB with Plan Dose on or and dose tracking reference point, you will
not get individual field values here. You will only see a total.



a
c
b
d

<!-- page 490 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
489
EC17.0-PCD-01-A
Varian Confidential
e) Click the Physical Properties tab to display information about the point location such as: CT
Values, Mass Density, and Physical Material Composition.
f)
After reviewing the information, click Close to close the dialog box.


Note: Multiple points can be added. When additional points are created, the Point Tool
dialog boxes may be superimposed and thus hiding the existing dialog boxes. Simply
relocate the dialog box(es) using the mouse.







e
f

<!-- page 491 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
490
EC17.0-PCD-01-A
Varian Confidential
Section 8: Default Options for Dose Display Setting
Eclipse allows the user to set default options for how plans are viewed. This is a user specific setting.
Settings can be changed as needed. Once set, these settings will apply to all plans opened by the logged
in user until they are changed by the user.
1) To access display options:
a) Select View.
b) Select Options.



a
b

<!-- page 492 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
491
EC17.0-PCD-01-A
Varian Confidential
c) View Options dialog box opens.
d) The General tab allows you to turn on and off various options as the default setting when
logging into the application.
e) Blend structures: applies to viewing blended structures. If disabled, structures from two
images (e.g. MRI and CT images blended) are always displayed. When enabled, the
structures displayed depend on where the blending slider is positioned (e.g., if the slider is
completely on one image, the structures from the other image are not visible.).




d
c
e

<!-- page 493 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
492
EC17.0-PCD-01-A
Varian Confidential
f)
Display orientation labels displays the patient orientation labels on the image.
g) Display slice position displays the position of the viewing plane sliders in the lower left-hand
corner of each window (x, y, or z position).



2) Click Plan Viewing tab provides options for how the planning image(s) is/are viewed on the
screen and is divided into 3 categories: Field, Dose, and Miscellaneous.



2
g
f

<!-- page 494 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
493
EC17.0-PCD-01-A
Varian Confidential
3) Field options determine how each planned field displays when selected. The most commonly
used options are noted below:


4) Cut field at isocenter truncates the projection of the field display at the isocenter.
a) Cut field at isocenter turned off: allows the projection of the beam to continue through the
isocenter.
b) Cut field at isocenter turned on: stops the projection of the beam at isocenter.





3
a
b

<!-- page 495 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
494
EC17.0-PCD-01-A
Varian Confidential
5) Show structure outlines: structures that are turned on or selected in the focus window are
projected as a structure outline in the Model/BEV/3D Window view.


6) Dose options: determine how the dose is displayed during the planning or review process. Each
option is defined below:





5
6

<!-- page 496 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
495
EC17.0-PCD-01-A
Varian Confidential
a) Color Wash displays the dose in Color Wash. Selecting it here sets it as the default rather
than having to turn it on manually as you did in the procedure above.
b) Isodose labels displays the Isodose labels on the Transverse, Frontal, and Sagittal views.
Whether this option is turned on or not, the Isodose labels will show on the plan printout.


a
b

<!-- page 497 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
496
EC17.0-PCD-01-A
Varian Confidential
7) Show DMAX:


a) Displays Dmax on each slice as a red dot.
b) The global dose max as a red cross with an orange circle.



a
b
7

<!-- page 498 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
497
EC17.0-PCD-01-A
Varian Confidential
8) 3D statistics displays the 3D dose statistics in the upper right corner of the model view for the
active, calculated plan.



Note: 3D Statistics displayed are for the target volume of the plan. To display dose
statistics for a different structure, modify the plan target volume in Plan Properties. DO NOT
FORGET to change the target back to the correct planned target prior to planning
approval.




8

<!-- page 499 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
498
EC17.0-PCD-01-A
Varian Confidential
9) Miscellaneous Options: offer options for the Model or 3D view. The most commonly used
option, Transversal Slice in BEV (Beam’s Eye View) is defined below:



a) Transversal slice in BEV: allows the user to see the location of the transversal slice in
relation to the 3D body rendering for reference.







9
a

<!-- page 500 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
499
EC17.0-PCD-01-A
Varian Confidential
Note: (b) Many of the options available in the View Options dialog box can be toggled
on/off in the Model/BEV/3D window by right click inside the Model/BEV window.





10) Dose coverage of the target can also be evaluated by using the 3D modeling of an Isodose cloud.
a) In the Focus window, click the checkmark from the Fields folder to deselect all fields.



a
b

<!-- page 501 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
500
EC17.0-PCD-01-A
Varian Confidential
b) Deselect all structures except Body and PTVprost SV marg in the Structure Set.


Note: Depending on user preference, you can also turn off the body contour/structure to
allow for better viewing of the Isodose cloud and the selected structure(s).





b

<!-- page 502 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
501
EC17.0-PCD-01-A
Varian Confidential
c) Right click on Dose and select Isodose Levels… from the menu.

d)  In the Relative Dose Isolevel Editor dialog box, uncheck (deselect) all isodose levels in the
3D column EXCEPT 100%.
e) Click OK.






d
e
c

<!-- page 503 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
502
EC17.0-PCD-01-A
Varian Confidential

f)
In the Model view, click the Maximize icon.
g) Click the 3D Tab.





h) Click and drag in the Model view, to rotate the image to view the 100% coverage of the
PTV Prost SV marg.
Note: If you are unable to move the image in the Model view, check to be sure that all tools
on the Toolbar are deselected.







h
f
g

<!-- page 504 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
503
EC17.0-PCD-01-A
Varian Confidential
Section 9: Dose Volume Histograms (DVH)
Overview: Dose Volume Histogram (DVH) is available for calculated plans. When the DVH is selected, it
displays in the model view.

1) To display a DVH, a treatment plan must be open, active, calculated, and have a dose
prescription.
a) To access the DVH, click Planning on the Menu bar.
b) Select Show Dose Volume Histogram View.



b
a

<!-- page 505 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
504
EC17.0-PCD-01-A
Varian Confidential
c) The Dose Statistics tab will be selected by default in the Info window.



d) Choose the structures to display on the DVH by selecting the Structure in the Show DVH
column.





c
d

<!-- page 506 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
505
EC17.0-PCD-01-A
Varian Confidential
e) Right click anywhere in the Dose Statistics tab to select Show DVH for All Structures.
This displays all structure on the DVH.




f)
Right click to Hide DVH for All Structures to hide all structure display on the DVH.





e
f

<!-- page 507 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
506
EC17.0-PCD-01-A
Varian Confidential
g) Click Bladder, Bladder Wall, PTVprost SV marg, Prostate, Rectum, and SV.






h) To group the selected structures together, click the Show DVH column. You may choose to
have the structures in ascending or descending order depending on the position of the
arrow in the column.






h
g

<!-- page 508 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
507
EC17.0-PCD-01-A
Varian Confidential
i)
To change the DVH line color and/or style, click the down arrow for a specific structure.
For this example, select the down arrow for the Prostate structure.




j)
Select Properties…



k) The Structure Properties dialog box opens.
l)
Select the General (continued) tab.



j
i
k
l

<!-- page 509 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
508
EC17.0-PCD-01-A
Varian Confidential
m) For this example, change the Line Style to a dashed line using the down arrow.
n) Click OK.



n
m

<!-- page 510 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
509
EC17.0-PCD-01-A
Varian Confidential
o) The prostate line is now dashed.




o

<!-- page 511 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
510
EC17.0-PCD-01-A
Varian Confidential
p) If there is a combination of structures you have not already created as a structure you can
create a temporary structure here to visualize the dose received to the structure on the DVH.
To combine structures, you must add an expression. Click the drop-down arrow at the
end of any structure line.
q) Select Add Expression.




p
q

<!-- page 512 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
511
EC17.0-PCD-01-A
Varian Confidential
r)
The Expression Properties dialog box opens.
s) For this example, let’s assume we do not have a structure that combines the Prostate and
SV.  From the structure list, click Prostate.
t)
From the Operators section, click OR.
u) Click SV.
v) From the Line color, Line style and Line width choose the options you wish to display.  For
this example, select orange, dashed line and a large line width.
w) Click OK.


r
s
t
u
v
w

<!-- page 513 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
512
EC17.0-PCD-01-A
Varian Confidential
x) The expression displays on the DVH.

Note: The newly created expression will not appear as a structure in your list of structures.
However, it will display on the printed DVH as well as here for the doctor to evaluate.




2) You can add columns to dose Statistics tab.
a) Right click anywhere in dose Statistics Info Window.
b) Select View Columns...




x
b
a

<!-- page 514 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
513
EC17.0-PCD-01-A
Varian Confidential
c) The DVH Column Selection dialog box opens.
d) You may choose from Dose or Volume in from the drop-down. For this example, select
Dose.


e) Add 95% in orange cell and click Add.
f)
The 95% is added to the DVH Column Selection.




c
e
d
f

<!-- page 515 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
514
EC17.0-PCD-01-A
Varian Confidential


g) You may now view the 95% for each structure in the Info Window.



g

<!-- page 516 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
515
EC17.0-PCD-01-A
Varian Confidential
Section 10: DVH Toolbar Options

1) There are options on the DVH Toolbar that allow you to customize the view.





a) To view the DVH options, click the DVH Options icon.



1
a

<!-- page 517 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
516
EC17.0-PCD-01-A
Varian Confidential
b) The DVH Options dialog box opens.
c) Select the Graph Type. For this example, click Cumulative Graph.
d) Select the Dose display. For this example, click Relative [%].  The relative dose displays on
the x-axis.






b
d
c

<!-- page 518 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
517
EC17.0-PCD-01-A
Varian Confidential
e) Select the Volume display. For this example, click Relative [%].  The structure volume
displays on the y-axis.
f)
Graph Limits sets the scale of the DVH based upon minimum and maximum values for dose
and volume.
g) Select Show Grid to display grid lines.


h) Select White Background to change the view to white.
i)
Click Apply.
j)
DVH Export Options to change the interval at which the dose values are printed to the
export file. Define a value. For this example, select 0.100%. The exported file displays the
value selected in the step size box.
k) Click OK.


e
g
h
i
k
j
f

<!-- page 519 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
518
EC17.0-PCD-01-A
Varian Confidential
l)
To export, from the menu, select File.
m) Select Export.
n) Select Export DVH in Tabular Format…


o) Save the file to the desired location, for this example select Desktop.
p) In the File Name, type a name.
q) Click Save.



p
q
l
m
n
o

<!-- page 520 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
519
EC17.0-PCD-01-A
Varian Confidential
r)
Navigate to the desktop and open the file, the exported file displays the value selected in
the step size box.
s) To close the DVH report, click ‘X’ in upper right corner.


t)
To return to the patient, click the patient’s icon at the bottom of the User Home screen.

t
s
r

<!-- page 521 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
520
EC17.0-PCD-01-A
Varian Confidential
2) You can choose the Cumulative Graph, Differential Graph, or Natural Graph buttons from the
Toolbar.
a) Choices made, whether in the DVH Options dialog box or by selecting the icons from the
Toolbar will be indicated by a highlighted icon.
b) Click Show Graph On White Background icon to toggle the background from black to white.






3) The Show Cross-hair icon allows you to click a point on any DVH structure line to display the
exact dose and volume at that specific location.


a) Click the Prostate line.
b) Information displays for the relative dose and volume for the structure Prostate.
c) Information for the structure, course, and plan displays for the point you select. For this
example, Prostate.


2
a
3
a
b
c
b

<!-- page 522 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
521
EC17.0-PCD-01-A
Varian Confidential
d) Deselect the Show Graph On White Background icon to change the background to back to
black.


e) Selecting the Show Grid icon turns the grid on. Deselect to turn the grid off.


d
e

<!-- page 523 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
522
EC17.0-PCD-01-A
Varian Confidential
f)
Show Dose Levels displays the selected Isodose levels for the plan on the DVH.



f

<!-- page 524 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
523
EC17.0-PCD-01-A
Varian Confidential
Section 11: DVH Other Options

1) There are several ways the user can enlarge the DVH view to read it more clearly for evaluation
purposes.

Note: The following screenshots have white DVH backgrounds for better visibility of some
of the features. You may choose either a black or white background.

a) Click the Maximize icon to expand the window.



a

<!-- page 525 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
524
EC17.0-PCD-01-A
Varian Confidential
b) Right click anywhere within the DVH.
c) Select Zoom Region.




b
c

<!-- page 526 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
525
EC17.0-PCD-01-A
Varian Confidential
d) Click and drag to define a region to enlarge.
e) The red box defines the area you selected.



f)
The selected region is enlarged to fit the DVH window.



d
f

<!-- page 527 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
526
EC17.0-PCD-01-A
Varian Confidential
g) Select Reset Zoom to return to the normal display.
g

<!-- page 528 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
527
EC17.0-PCD-01-A
Varian Confidential
Section 12: Plan Comparison DVH

Often multiple plans are created to achieve the best plan. Creating a Plan Comparison DVH allows the
physician to decide which plan best meets the treatment goals.
1) Plan Comparison DVHs can be created from two or more plans that have dose prescriptions and
are calculated.
Note: The Plans being compared can be on two different 3D images and have different
calculation volumes (in terms of slices of the data set) if the image sets of the two plans
being compared are registered together.

Note: You may drag and drop multiple plans for a Plan Comparison DVH.
a) Select Open Objects icon.

b) The Object Explorer opens.
c) Expand Course1 in the left panel.
d) Select Acuros Calc plan.
e) Click OK

a
c
d
b
e

<!-- page 529 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
528
EC17.0-PCD-01-A
Varian Confidential
f)
The Acuros Calc plan loads.
g) Select the Calculation Models tab from the Information Window.
h) Click Use Default Models.
i)
Select AXB_17.0.1 calculation model for the volume dose.
j)
Click Calculate Volume icon from the tool bar.


Note: Set the Dose per Fraction at 200cGy X 30 fx and total field weights = 1.0.








i
g
h
f
j

<!-- page 530 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
529
EC17.0-PCD-01-A
Varian Confidential

k) Select Planning menu.
l)
Select Create Plan Comparison DVH…

























l
k

<!-- page 531 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
530
EC17.0-PCD-01-A
Varian Confidential
m) The Plan Comparison DVH Properties dialog box opens.
n) Select the plans to compare.  For this example, check the AAA Dose Calc, and Acuros Calc
plans.
o) Click OK.


















m
n
o

<!-- page 532 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
531
EC17.0-PCD-01-A
Varian Confidential
p)  The Plan Comparison DVH displays.
q) The system automatically assigns symbols to the DVH lines to differentiate between the
selected plans. For example, triangles, squares, etc.


Note: To view the Comparison DVH later, click and drag the Plan Comparison DVH from
the scope window into the viewing window.













p
q

<!-- page 533 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
532
EC17.0-PCD-01-A
Varian Confidential
2) At first, the structures for the selected plans will be grouped together by plan. The specific plan is
noted in the Plan column of the Dose Statistics tab.
a) Click the Structure column title
 to group the structures from each plan
together.
b) The legend displays in the Show DVH and Structure columns in the Dose tab.




b
a

<!-- page 534 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
533
EC17.0-PCD-01-A
Varian Confidential
3) Plans can be viewed side by side using the Plan Evaluation application. To view the plans side by
side
a) Select Plan Evaluation from the Workspace Bar.


b) If the Object Explorer opens, click Course 1 and then, Close.




4) When Plan Evaluation opens:
a) Select Window drop-down.
b) Select Two Orthogonal Views.

a
b
a
b

<!-- page 535 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
534
EC17.0-PCD-01-A
Varian Confidential
c) Two 3-View windows open. The first plan that is selected in Evaluation will appear in the
first 3 – View window.


d) Select the plan to compare and drag it to the second 3 – view window.  For this example,
select Acuros Calc plan.


c
d

<!-- page 536 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
535
EC17.0-PCD-01-A
Varian Confidential
5) Plans in the Plan Evaluation application may be linked via their geometries. This allows you to
scroll through the same planes on the linked plans. It also allows you to pan and zoom the plans
together for plan comparison purposes.
a) To link the plans, click Link View Geometries icon.


b) To view a DVH, click Evaluation.
c) Select Show Dose Volume Histogram View from the menu.


d) The DVH appears between the two plans.


a
b
c
d

<!-- page 537 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
536
EC17.0-PCD-01-A
Varian Confidential
e) The structures for each plan will display in the Dose Statistics tab. Selecting the same
structures for each plan will give a true comparison of coverages between the two plans.
Note: Placing the mouse cursor at the bottom margin between the windows and the tabbed
section(s) at the bottom will allow the user to drag the margin up or down to enlarge or
decrease the visibility of the tabbed section. Making the tabbed section larger, in turn,
makes the viewing section above smaller.




f)
To change window layout, from the Menu bar, select Window.
g) For this example, select Two Model/BEV Views.



f
e
g

<!-- page 538 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
537
EC17.0-PCD-01-A
Varian Confidential
h) The Model/BEV displays at the top and the DVH displays at the bottom.






h

<!-- page 539 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
538
EC17.0-PCD-01-A
Varian Confidential
i)
Choosing Multiple Plans allows the user to choose up to six different plans to compare by
dragging the desired plans into the open windows.



i

<!-- page 540 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
539
EC17.0-PCD-01-A
Varian Confidential
Section 13: DVH Printing

1) Printing a DVH:
a) Right click anywhere in the DVH window.
b) Select Print DVH Report...



b
a

<!-- page 541 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
540
EC17.0-PCD-01-A
Varian Confidential
c) The Print Treatment Report dialog box opens.
d) Select the local or network printer.
e) The Layout will default to DVH.tml format. While the format can be changed using the drop-
down, for this example, leave the default.

Note: If a different format is selected and you want it to be the default, click Set as Default.




d
e
c

<!-- page 542 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
541
EC17.0-PCD-01-A
Varian Confidential
f)
To enter a comment, type in the Print Comment field. For this example, type: Planning
approved, Pending Treatment Approval.
g) Click OK or click Preview to preview the report. For this example, click Preview.




f
g

<!-- page 543 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
542
EC17.0-PCD-01-A
Varian Confidential
h) The comment entered in the Print Treatment Report dialog box appears on the report.
i)
To close the preview, click Close.

Note: After previewing the report, the system returns you to the External Beam application.
If you choose to print the report after previewing, you must re-enter any comments you wish
to display on the report.

<!-- page 544 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
543
EC17.0-PCD-01-A
Varian Confidential
 Image Registration
Section 1: Image Registration Overview
References:
1) Image Registration and Segmentation Instructions for Use P1047687-002-B
2) On-Board Imager Reference Guide

Introduction
The intended use of the Image Registration Application is to complement treatment planning system
capabilities allowing you to create rigid registrations or matches between two 3D images. Registration
between image sets can occur prior to planning or after planning.
Overview
The Registration Application in Eclipse supports image registrations of any combination of CT, CBCT,
MRI, and PET.
 Multiple registrations between different image sets on the same patient may be easily created.
 Multiple 3-D image sets may be registered together.
 Plans created on different 3-D images on the same patient can be summed, provided the 3-D
image sets are registered.
 Structures may be delineated in the Contouring Application on any of the 3-D image sets or the
blended image which is an overlay of the images.
 Multiple registrations can be done between the same 2 images, focusing on different volumes of
interest. For example, if you have 2 areas of interest but the patient position between the 2 study
sets is significantly different (A patient scanned on a headrest for one study and a pillow for the
other study).
 Undo and redo changes in Registration by, Edit > Undo or Ctrl + Z, Redo or Ctrl + Y.
 If a previous registration is open and un-approved, it is possible to over-write it.

<!-- page 545 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
544
EC17.0-PCD-01-A
Varian Confidential
Note: Please be aware that there is potential for many sources of inaccuracy within the
registration. These include: patient movement, patient position, finite slice thickness and
resolution, image distortion, inaccuracy in registration point placement.


Rigid Registrations Methods:
 Auto Matching: an automatic match algorithm. It can be used for CT, MRI, CBCT or PET scans
 Manual Match: can be used to manually shift one image to match the other using the translate
and rotate functions
 It can be used as the primary match by shifting one image set in reference to the other to get
a closer match prior to using Auto Match
 Point Match: The user places matching points on corresponding locations on the two image sets
to be matched. The system then matches the two images based on the points defined. This is
used when the other options do not facilitate an acceptable match
 DICOM origin: Images that share the same DICOM origin are automatically registered together.
There is a visibility checkbox in the ‘New rigid registration dialog box’ that may be used to register
images using their DICOM origin.

<!-- page 546 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
545
EC17.0-PCD-01-A
Varian Confidential
Section 2: Navigate to Image Registration
1) To navigate to the Image Registration Application from the menu bar:
a) Select QuickLinks dropdown.
b) Select Imaging category.
c) Select Image Registration.

b
a
c

<!-- page 547 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
546
EC17.0-PCD-01-A
Varian Confidential
d) The Image Registration Application opens.
e) To open a patient, type name—first or last, or ID in the Search Patient box.  For this
example, begin typing EC.
f)
From the list, select EC OPS, Registration (US-EC-2003).


e
f
d

<!-- page 548 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
547
EC17.0-PCD-01-A
Varian Confidential
2) The Image Registration Application opens.
a) All 3D image sets are automatically loaded and displayed in the Image Icon Strip.



a

<!-- page 549 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
548
EC17.0-PCD-01-A
Varian Confidential
b) Hovering the mouse over any image allows you to see the properties of the 3D image such as
modality, date, and approval status of image.
c) Double click the 3D image of interest from the Image icon strip. For this example, CT_1.


c
b

<!-- page 550 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
549
EC17.0-PCD-01-A
Varian Confidential
d) The image of interest is displayed in the Content Preview as the active image.






d

<!-- page 551 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
550
EC17.0-PCD-01-A
Varian Confidential
e) Hovering the mouse over the Content Preview allows you to view any structures that may be
attached to that image.


f)
Hovering the mouse over the small square in the upper left corner allows you to view options
for the structure strip.



e
f

<!-- page 552 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
551
EC17.0-PCD-01-A
Varian Confidential
g) Click the small square to close the Content Preview.



h) Right click the small square to check or uncheck “Auto-hide Structures List.” For this
example, uncheck the checkbox. This allows the structures to always be visible.

g
h

<!-- page 553 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
552
EC17.0-PCD-01-A
Varian Confidential
i)
Click the small square again to open Content Preview. The Structure List is visible under it.







i

<!-- page 554 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
553
EC17.0-PCD-01-A
Varian Confidential
Section 3: Create a New Rigid Registration using Auto Match

1) To begin a new registration:
a) Select Registration menu.
b) Select Auto Matching.


a
b

<!-- page 555 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
554
EC17.0-PCD-01-A
Varian Confidential
2) The New Rigid Registration dialog box appears.
a) CT_1 (the active image) will be automatically selected as the Target image (or primary
image).
b) Type Name: CT_1 TO MR_1.
c) Select the MR_1 as the Source Image (or secondary image).
d) Click OK.






c
a
b
d

<!-- page 556 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
555
EC17.0-PCD-01-A
Varian Confidential
e) The Auto Matching dialog box opens.
Note: Default Parameter Set is for the default settings for OBI and Offline Review. User
Defined can be used to optimize the performance of a specific use case by adjusting the
algorithmic parameters in the Options dialog. In this case use Extended Range.

f)
For Rigid Registration: Extended Range is the default parameter set pre-configured for
optimum performance. For this example, select Extended Range.



e
f

<!-- page 557 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
556
EC17.0-PCD-01-A
Varian Confidential
g) Axes: switches the transitional and rotational matching dimensions on and off. Select the
axes for matching. In this case select Vrt, Lng, Lat, Rot, Pitch and Roll.
h) Intensity Range and Structure VOI are parameters that are typically used for 3D/3D match
at the OBI or in Offline Review. In this example, do not check these options.




g
h

<!-- page 558 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
557
EC17.0-PCD-01-A
Varian Confidential
i)
Expand the Volume of Interest (VOI) box in all views to encompass the area in the two
image sets that are to be matched.















i

<!-- page 559 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
558
EC17.0-PCD-01-A
Varian Confidential

j)
Volume of Interest (VOI) is expanded in all views.
Note: The CT is longer than the MR, be sure to adjust your VOI to include everything so the
auto match will be more successful.












j

<!-- page 560 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
559
EC17.0-PCD-01-A
Varian Confidential



k) Click Start.



l)
The dialog box shows the Status and a status bar for the auto matching.




k
l

<!-- page 561 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
560
EC17.0-PCD-01-A
Varian Confidential
m) The status displays Match Finished.
n) If you wish to change any of the match parameter sets or matching criteria such as axes, you
may click the Reset button.  In this example, click Close.





m
n

<!-- page 562 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
561
EC17.0-PCD-01-A
Varian Confidential
Section 4: Evaluating a Registration Match
1) The match is ready for review.
a) A straight line with an arrow appears under the two images indicating a match.
b) A blended view automatically displays. To view one image more than the other use the toggle
slider at the bottom of any view.



a
b

<!-- page 563 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
562
EC17.0-PCD-01-A
Varian Confidential
c) To help evaluate the match result easier, you can display the match result in a color blended
view. Navigate to the View menu option.
Note: The evaluation icons are also available on the Toolbar.

d) Select Color Blending from the dropdown options.



d
c

<!-- page 564 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
563
EC17.0-PCD-01-A
Varian Confidential
e) A color blended view of the match displays and the blending toggle bar can be adjusted as
desired.
Note: The colors used in color blending may be user defined from the Tools> Options>
Display.





e

<!-- page 565 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
564
EC17.0-PCD-01-A
Varian Confidential
f)
Another way to evaluate the results is with the Split Window. Select View.
g) Select Split.



g
f

<!-- page 566 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
565
EC17.0-PCD-01-A
Varian Confidential
h) All three 2D views displays with a split view.  Adjust the split window by moving the Red +
with the mouse.

h

<!-- page 567 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
566
EC17.0-PCD-01-A
Varian Confidential
i)
To access another useful tool, navigate to View.
j)
Select Moving Window.




i
j

<!-- page 568 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
567
EC17.0-PCD-01-A
Varian Confidential

k) Adjust the size of the moving window by clicking and dragging any of the Red marked corners
of the viewing window. The smaller window shows the source image (secondary) overlaid
onto the target image (primary). The moving window may also be panned by clicking inside
the window and dragging it to a desired place.




k

<!-- page 569 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
568
EC17.0-PCD-01-A
Varian Confidential
l)
Navigate to the View menu option to adjust contrast within a 3D image
m) For this example, deselect the Moving Window.





l
m

<!-- page 570 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
569
EC17.0-PCD-01-A
Varian Confidential
n) Select View.
o) Select Window / Level to adjust contrast.





o
n

<!-- page 571 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
570
EC17.0-PCD-01-A
Varian Confidential
p) Deselect Color Blending.



p

<!-- page 572 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
571
EC17.0-PCD-01-A
Varian Confidential
q) To set Window/Level of the primary target CT image to preset values, right click on the
Window /Level bar to the Left of the image and select Range.
r)
Choice of anatomical sites display, choose the appropriate option. For this example, select
Cerebellum.
s) Alternatively, drag the window or level arrow on the left-hand side.

q
r
s

<!-- page 573 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
572
EC17.0-PCD-01-A
Varian Confidential
t)
Drag the window or level arrow on the Right-hand side to adjust the Source (secondary)
Image.






t

<!-- page 574 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
573
EC17.0-PCD-01-A
Varian Confidential

Note: Alternatively, you can press the CTRL key on the keyboard, while using the scroll
wheel on the mouse. This will allow zooming in and out, as well.

u) To zoom an image, select the View menu.
v) Select Zoom In.




u
v

<!-- page 575 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
574
EC17.0-PCD-01-A
Varian Confidential

w) The image is zoomed.

















w

<!-- page 576 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
575
EC17.0-PCD-01-A
Varian Confidential
x) To reset the image, select View again.
y) Select Reset All Views to reset zoom to the original settings of the image.









y
x

<!-- page 577 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
576
EC17.0-PCD-01-A
Varian Confidential
z) To pan an image, navigate to View.

Note: Alternatively, you can press the scroll wheel while moving the mouse.

aa) Select Pan.











aa
z

<!-- page 578 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
577
EC17.0-PCD-01-A
Varian Confidential




bb) The image is “Panned”.



bb

<!-- page 579 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
578
EC17.0-PCD-01-A
Varian Confidential
cc) Click View.
dd) Select Reset All Views to reset to the original settings.


Note:  To undo step by step to the last time you saved, use Ctrl Z. To redo use Ctrl Y.




cc
dd

<!-- page 580 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
579
EC17.0-PCD-01-A
Varian Confidential
ee) Click View to change the view layout.
ff) Select View Layout.
gg) A list of each layout option displays. For this example, select 4 Views.


ee
gg
ff

<!-- page 581 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
580
EC17.0-PCD-01-A
Varian Confidential
hh) This is an example of a 4 view Layout.




hh

<!-- page 582 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
581
EC17.0-PCD-01-A
Varian Confidential
Section 5: Create a Rigid Registration using Manual Match

Note: It is possible to over-write previous registrations performed during the same session,
or previous registrations which are unapproved and loaded into the window. To create an
additional registration, select only one CT/MR/PET/CBCT image, not the Registration!


1) Create a new registration using Manual Match.
a) Activate your target (primary) image from your Image Icon Strip. Double Click CT_2.




a

<!-- page 583 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
582
EC17.0-PCD-01-A
Varian Confidential
b) Click Registration menu and select Manual Match.



c) In the Name field type, MANUAL MATCH.
d) Select the Target Image CT_2.
e) Select the Source Image as MR_1.
f)
Click OK.



c
f
d
b
e

<!-- page 584 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
583
EC17.0-PCD-01-A
Varian Confidential
g) To Pan the Source image over the Target image, Place the cursor
 inside the red
circle in any of the views to manually match the anatomy. Use the keyboard arrow keys to
nudge the match slightly in any view. Use the Alt + arrow keys on the keyboard to move the
image in large steps.
Use

















g

<!-- page 585 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
584
EC17.0-PCD-01-A
Varian Confidential
h) To rotate the image, place the curser
  outside of the red circle. Use the Ctrl key and
the keyboard arrows to rotate the image slightly, in any view such as to adjust for chin tilt.
Use the CTRL+ALT and the left and right arrows on the keyboard to make larger movements.




h

<!-- page 586 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
585
EC17.0-PCD-01-A
Varian Confidential
i)
Right click the Slider to choose the Flicker options. Choose the speed of the flicker. To
deactivate, click the slider again.
Note: Use the review tools to review the manual match. Always visually verify all
registrations.








i

<!-- page 587 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
586
EC17.0-PCD-01-A
Varian Confidential

Section 6: Other Registration Options
1) To delete a registration, it must be loaded in the view.
a) To load the registration, double click the registration line.
a

<!-- page 588 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
587
EC17.0-PCD-01-A
Varian Confidential
b) Right click the bolded registration line.
c) Select Delete.
b
c

<!-- page 589 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
588
EC17.0-PCD-01-A
Varian Confidential
2) You can set the status of a registration to Unapproved; Reviewed; Approved or Retired.
a) Load the registration by double clicking the solid line for the registration.
b) Right click registration and select Set Registration Status.
c) Select Reviewed.


b
a
c

<!-- page 590 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
589
EC17.0-PCD-01-A
Varian Confidential
d) The Status Change Confirmation dialog box appears.
e) Select the appropriate registration.
f)
Click OK.


g) Type User Name and Password and click Yes.


d
e
f
g

<!-- page 591 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
590
EC17.0-PCD-01-A
Varian Confidential
h) Notice that the color of the line representing the registration turns Blue for a Reviewed status.


i)
Now change the status to approved. The Registration line appears green when the status is
changed to Approved.
j)
A registration that is approved cannot be modified. Right click the approved Registration and
select Delete.




h
j
i

<!-- page 592 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
591
EC17.0-PCD-01-A
Varian Confidential
k) A message appears informing the user that an approved registration cannot be modified




k

<!-- page 593 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
592
EC17.0-PCD-01-A
Varian Confidential
Section 7: Set System Preferences
1) System preferences can be set up under Tools > Options for each individual user for the
Registration Application.

Note: Values set in options are used throughout the system, not just in Registration. These
settings are saved as the User’s preference.


a) Open Tools menu.
b) Select Options.




b
a

<!-- page 594 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
593
EC17.0-PCD-01-A
Varian Confidential
2) Main Window allows you to select the size of the buttons on the Toolbar.
a) To display the Workspace Bar in the related Applications like Contouring; Smart
Segmentation and Smart Adapt, select Show Workspace Bar.




a
2

<!-- page 595 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
594
EC17.0-PCD-01-A
Varian Confidential
3) The Display section allows you to set your preferences for displaying different modalities in
different colors for 2D and 3D rendering.
a) Additionally, you may select to Show Boluses.


a
3

<!-- page 596 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
595
EC17.0-PCD-01-A
Varian Confidential
b) You may also set the color for Color Blending.


4) Auto Matching allows you to select the auto matching algorithm parameter sets and make
custom modifications.
a) From the Parameter Set drop down menu, select the Default set.
b) Notice the size of the Search Range in the translation and rotation.


b
4
a
b

<!-- page 597 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
596
EC17.0-PCD-01-A
Varian Confidential

c) Select the Extended Range set.
d) Notice that the Search Range for translation and rotation area is increased to 100 and 45
mm respectively.


d
c

<!-- page 598 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
597
EC17.0-PCD-01-A
Varian Confidential
5) Window and Level Presets options. These settings define the default Upper and lower HU
levels for different tissue and organ types.

5

<!-- page 599 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
598
EC17.0-PCD-01-A
Varian Confidential
6) Automatic Body Search on CT Opening allows the Body to be contoured automatically if there
is no Body available on the opening of the 3D CT image. If there is a structure already named
Body attached to the CT image, the auto body function will not work.

6

<!-- page 600 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
599
EC17.0-PCD-01-A
Varian Confidential
7) Brush and Eraser: if Show Brush Trail (faster) is checked, allows for faster contouring with the
Brush or Eraser in remote environments.





7

<!-- page 601 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
600
EC17.0-PCD-01-A
Varian Confidential
8) Zooming: allows you to change the direction of rotation for the mouse zooming in/out.
9) Click OK.



8
9

<!-- page 602 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
601
EC17.0-PCD-01-A
Varian Confidential
Section 8: Contour on a Registered Image

1) Once you have registered datasets, you can contour on the registered dataset.
2) The purpose of registering different modalities with the planning CT is to ensure that you visualize
the scanned patient in another modality so that you can adequately contour the structures.
a) Navigate to the Contouring workspace. If not already open, open patient, EC OPS,
Registration (US-EC-2003).
b) Double Click the registration line to display the registration in the viewing planes.




b
a

<!-- page 603 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
602
EC17.0-PCD-01-A
Varian Confidential
c) Once the images display, right click on CT_2.




c

<!-- page 604 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
603
EC17.0-PCD-01-A
Varian Confidential
d) From the drop-down menu, select New Structure…


d

<!-- page 605 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
604
EC17.0-PCD-01-A
Varian Confidential
e) From the drop-down, select a Structure Code, for this example select CTV Intermediate
Risk.
f)
In the ID field retype something that is meaningful to your process, for this example type CTV
Brain.
g) Click Create



f
g
e

<!-- page 606 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
605
EC17.0-PCD-01-A
Varian Confidential
h) Using the blend slider, move to display the MRI image.
i)
Click the icon to maximize the Transversal view.


h
i

<!-- page 607 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
606
EC17.0-PCD-01-A
Varian Confidential
j)
Scroll to the tumor volume.
k) Select the CTV Brain structure.
l)
Select a tool from the Drawing Tools. For this example, select the Draw Planar Contour.
m) Contour the CTV Brain.




k
m
j
l

<!-- page 608 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
607
EC17.0-PCD-01-A
Varian Confidential
n) Once contouring is complete, scroll to the Z: 2.55cm slice.
o) Use the slider bar and move the view to the CT dataset
p) Because you contoured on the registered images, the contouring is attached to the CT
dataset and ready for planning.

Note: If we had only used the CT dataset to contour the tumor volume, we would have
missed a lot of diseased tissue. Therefore, it is important to note that you use the modalities
that you have registered to contour and evaluate the contouring.

q) Click Save All to save your work.






p
n
o
q

<!-- page 609 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
608
EC17.0-PCD-01-A
Varian Confidential
Section 9: CT-PET Contouring
The Standardized Uptake Value (SUV) is a value that supports the quantitative assessment of the
accumulation of an injected radiopharmaceutical within the human body; the SUV depends on several
parameters such as injected activity, detected counts on the PET images and patient specific data. PET
images visualize the distribution of different radiopharmaceuticals in a patient. The radiopharmaceutical
most often used is 18 Fluor Deoxy Glucose (FDG), which reflects the glucose metabolism. Glucose is
often increased in fast growing tumor tissue, translating into high SUV values.
You can contour on PET images using the SUV tool.

1) To contour on a PET image:
a) Open patient, US-PETCT-001 CT PET, US PT. All 3D images will be available.
Note: If the PET and CT images share the same frame of reference (FOR), they will be
automatically registered. In this example, they do share the same frame of reference
indicated by the orange dotted line.

b) Double click the PET 3D image.



a
b

<!-- page 610 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
609
EC17.0-PCD-01-A
Varian Confidential

c) The PET dataset displays in the view.
d) The color of the PET may be changed, by selecting Tools.
e) From the menu, select Options…

c
e
d

<!-- page 611 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
610
EC17.0-PCD-01-A
Varian Confidential
f)
Select Display.
g) From the Image Color Maps section, you can select from the drop -down menu next to the
PET 2D / 3D row. For this example, do not change the color.

f
g

<!-- page 612 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
611
EC17.0-PCD-01-A
Varian Confidential
h) The SUV display type may be changed by selecting Standardized Uptake Value.
i)
Select the box next to Display SUV.
j)
Select the radio button next to Body Weight [g/ml].
k) Click OK.



h
i
j
k

<!-- page 613 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
612
EC17.0-PCD-01-A
Varian Confidential
2) To calculate the SUV, you must have patient data.
a) To enter the patient’s data, select Tools.

Note: If the required information is not defined you will not be able to display SUV. Both
Patient Weight and Height typically are included in DICOM PET scans.

b) From the drop-down menu, select Show PET Patient Data…

a
b

<!-- page 614 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
613
EC17.0-PCD-01-A
Varian Confidential
c) Enter the patient data. For this example, enter 1.6 for Patient Height (m) and 52.30 for
Patient Weight (kg).
d) Click OK.

c
d

<!-- page 615 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
614
EC17.0-PCD-01-A
Varian Confidential
e) Use the Window/Level tool to adjust the intensity of the PET scan.

Note: The highest area of trace uptake will be the brightest/darkest/most intense depending
on the color scheme used.

f)
Use the slider to adjust the window level until you see a darker area of intensity.



e
f

<!-- page 616 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
615
EC17.0-PCD-01-A
Varian Confidential
3) To outline and automatically contour of the high trace activity area:
a) Right click on the PET image.
b) From the menu, select New Structure…

a
b

<!-- page 617 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
616
EC17.0-PCD-01-A
Varian Confidential
c) The Create New Structure dialog box opens.
d) From the Structure Code drop down, select GTV Primary.
e) From the Color dropdown, change color to Purple.
f)
Click Create.




c
d
f
e

<!-- page 618 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
617
EC17.0-PCD-01-A
Varian Confidential
g) The new structure is created.
h) Zoom image to better visualize the volume in all views.
i)
Move viewing planes to center of tumor volume in all views.
j)
Select the PET Subvolume Thresholding tool.




g
i
h
j

<!-- page 619 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
618
EC17.0-PCD-01-A
Varian Confidential
4) The PET Subvolume Thresholding tool opens.
a) The Threshold defaults to 40%.
b) Select the VOI.



4
a
b

<!-- page 620 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
619
EC17.0-PCD-01-A
Varian Confidential
c) Adjust the VOI to the object to be contoured in all viewing planes.



c

<!-- page 621 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
620
EC17.0-PCD-01-A
Varian Confidential
d) Bring the PET cursor to the highest activity within the tumor.


d

<!-- page 622 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
621
EC17.0-PCD-01-A
Varian Confidential
e) The extension of the structure will be calculated and contoured based on the maximum
intensity of the PET tracer, using the default threshold.
f)
The threshold uptake may be increased or decreased by using the slider bars within the PET
Subvolume Thresholding tool or within any of the graphics views.



e
f

<!-- page 623 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
622
EC17.0-PCD-01-A
Varian Confidential
g) Increasing the threshold may better delineate the tumor volume.

Note: You can change the color of the structure to better delineate the contouring from the
uptake values.



g

<!-- page 624 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
623
EC17.0-PCD-01-A
Varian Confidential
5) Copy structure from PET to CT.
a) Double click the yellow FOR box around the Image Icon strip.
b) Both image sets are opened and blended.
c) Right click on the GTVp.




a
c
b

<!-- page 625 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
624
EC17.0-PCD-01-A
Varian Confidential
d) From the menu, select Copy Structures to Registered Image.




d

<!-- page 626 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
625
EC17.0-PCD-01-A
Varian Confidential
e) The Propagate Structures dialog box briefly opens displaying the progress while the
structures are being copied.



e

<!-- page 627 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
626
EC17.0-PCD-01-A
Varian Confidential
f)
The GTV structure is copied to the CT dataset.
g) Select Save All, to save your work.



g
f

<!-- page 628 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
627
EC17.0-PCD-01-A
Varian Confidential
 Appendix
Section 1: Eclipse Icon Table
Context Window Hierarchy Tree
       Icon
      Name
                  Description

Patient
First thing in the Hierarchy Tree. Displays the
Patient’s Unique ID

Study
In DICOM hierarchy, Image Series belong to a
Study.

Image Series
Holds all 2D single imported images and 3D
volumes.  Multiple 3D images may be created from
the same 2D slices.

Single
Image/Slice
Represents a single CT/MR/PET imported image.
The 2D Images are used to generate the 3D
volume.

3D Volume
The three-dimensional volume is created from a
“stack” of imported 2D image slices.
CBCT automatically creates a 3D volume.

Course
A collection of patient irradiation events, aimed at
obtaining a therapeutic goal. A Course contains all
plans which are delivered to the same or different
treatment sites. A Course may contain multiple
plans.

Structure Set
Structure Set contains all structures to be
segmented for a certain body area. A structure is
connected to a 3D volume. It can be anatomical
organs, treatment volumes, support structures,
reference lines, or markers.


Structure
A structure is connected to a 3D volume. It can be
anatomical organs, treatment volumes, support
structures, reference lines, or markers.
If at least one slice of the structure has been
segmented, the icon will be filled.

<!-- page 629 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
628
EC17.0-PCD-01-A
Varian Confidential
Context Window Hierarchy Tree
If no slices have been contoured, the icon will be
empty.

Bolus




Linked Bolus
A bolus is tissue-equivalent material placed on the
patient’s skin. It provides additional tissue so that
the maximum dose will be delivered closer to the
skin surface. Boluses are attached to the 3D
volume. In Halcyon plans, boluses are attached to
the plan. Multiple boluses may be attached to a
single 3D volume and linked to multiple plans.
Linked Boluses are boluses that have been
attached to a particular field. Unless the bolus is
linked to the field or Halcyon plan, it will not be
included in the calculation.

Marker
A marker may be used to mark the Isocenter or
another area in the 3D volume.

Plan


Planning
Approved Plan
Treatment
Approved Plan
Retired Plan
A plan is a group of treatment fields, which are
treated together. Each plan is linked to a
particular structure set and 3D volume.
The first icon indicates an unapproved plan.
The second icon indicates a Plan Approved plan
indicated by the blue frame.
The third icon indicates a Treatment Approved plan
indicated by the green frame.
The fourth icon indicates a Retired Plan indicated by
the grayed-out icon.

Folder
Used to group related objects together.  I.E.:
reference images, structures, bolus, reference
points, fields, etc.

<!-- page 630 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
629
EC17.0-PCD-01-A
Varian Confidential


Reference Point

        And

Primary Reference
point
A reference point is a point in the body into which dose may
be accumulated at treatment time. A reference point is
related to the patient and 3D volume and shared by
multiple plans. A 3D volume can have multiple reference
points.
The Primary Reference Point has a yellow box around it.
The Primary Reference Point tracks the prescription. Only
one primary reference point can be defined per plan. It is
recommended to use the DPV (Dose Prescription Volume)
as the primary reference point. The DPV ensures that the
prescribed dose equals the delivered dose.

Dose
Represents the calculated 3D dose for a given plan. Can
be displayed as either absolute or relative, and conveyed
by means of isodose, isodose color wash or color wash
visualization.

Planning or Treatment
Field
A plan is comprised of one or more fields. Each field
typically defines the parameters necessary to deliver dose
to the patient. The treatment parameters include
geometrical and physical settings, and MU.

MLC
Represents that an MLC is attached to the field. The MLC
is used to shape the treatment area for dynamic and static
fields.

Aperture Block

And

Shielding Block
Represents that a block is attached to the field. The block is
used to shape the treatment area for static fields. They
prevent critical organs or other areas outside the target
structure from being exposed to radiation. The shape can
be defined either manually or automatically.
Aperture blocks are used for electron cutouts or negative
cutouts, and shielding blocks are used for island blocks.

Wedge
Represents a hard wedge or a dynamic wedge attached to
a field.

Registered Images
Represents a link between 3D Images that have been
Registered together.

Setup Field
Setup Fields are image only fields used to verify the
treatment position matches the planned position.

<!-- page 631 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
630
EC17.0-PCD-01-A
Varian Confidential

DRR or Reference
Image
DRRs may be created for Treat or Setup Fields. These
DRRs can be the reference image for the fields or other
images may be assigned as reference images.

<!-- page 632 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
631
EC17.0-PCD-01-A
Varian Confidential
Section 2: Keyboard Shortcuts

<!-- page 633 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
632
EC17.0-PCD-01-A
Varian Confidential

<!-- page 634 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
633
EC17.0-PCD-01-A
Varian Confidential

<!-- page 635 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
634
EC17.0-PCD-01-A
Varian Confidential
Section 3: Workspace Icons
                           RT Summary--Timeline Icons

<!-- page 636 -->

Eclipse 17.0 Basic Planning

DC-DOC-11-C
635
EC17.0-PCD-01-A
Varian Confidential
                                                 RT Summary--Session Icons

                                             Plan Scheduling Icons
